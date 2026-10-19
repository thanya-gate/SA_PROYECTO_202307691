import { z } from 'zod';
import { ClaseFederada } from './mapper';

// Puerto: lo que YoUSAC necesita de un catálogo aliado. El buscador y el
// reproductor dependen de esta interfaz, no del HTTP del otro grupo.
export interface CatalogoExterno {
  readonly nombre: string;
  buscar(q: string, page: number): Promise<ClaseFederada[]>;
  obtener(id: string): Promise<ClaseFederada | null>;
}

const capituloSchema = z.object({ titulo: z.string(), inicioSeg: z.number(), finSeg: z.number() });

const claseSchema = z
  .object({
    id: z.string(),
    titulo: z.string(),
    curso: z.string(),
    videoUrl: z.string(),
    tipoVideo: z.enum(['archivo', 'youtube']),
    capitulos: z.array(capituloSchema).default([]),
    origen: z.object({ grupo: z.string(), institucion: z.string() }),
    codigoCurso: z.string().optional(),
    unidad: z.string().optional(),
    semestre: z.string().optional(),
    anio: z.number().optional(),
    catedratico: z.string().optional(),
    duracionSeg: z.number().optional(),
    notasMd: z.string().optional(),
  })
  .passthrough();

const paginaSchema = z.object({ resultados: z.array(claseSchema) }).passthrough();

export interface OpcionesHttp {
  baseUrl: string;
  apiKey: string;
  nombre: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

// Adaptador HTTP del contrato openapi/federacion.yaml. Si el aliado falla o
// responde algo fuera del contrato, degrada a vacío para no tumbar el catálogo local.
export class HttpCatalogoExterno implements CatalogoExterno {
  readonly nombre: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opciones: OpcionesHttp) {
    this.nombre = opciones.nombre;
    this.fetchFn = opciones.fetchFn ?? fetch;
  }

  private async pedir(ruta: string): Promise<unknown | null> {
    const url = `${this.opciones.baseUrl.replace(/\/+$/, '')}${ruta}`;
    try {
      const res = await this.fetchFn(url, {
        headers: { 'X-API-Key': this.opciones.apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.opciones.timeoutMs ?? 3000),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(JSON.stringify({ nivel: 'WARN', evento: 'federacion_externo_error', ruta, error: String(err) }));
      return null;
    }
  }

  async buscar(q: string, page: number): Promise<ClaseFederada[]> {
    const datos = await this.pedir(`/clases?q=${encodeURIComponent(q)}&page=${page}`);
    const parsed = paginaSchema.safeParse(datos);
    return parsed.success ? (parsed.data.resultados as ClaseFederada[]) : [];
  }

  async obtener(id: string): Promise<ClaseFederada | null> {
    const parsed = claseSchema.safeParse(await this.pedir(`/clases/${encodeURIComponent(id)}`));
    return parsed.success ? (parsed.data as ClaseFederada) : null;
  }
}

export function crearCatalogoExterno(baseUrl: string, apiKey: string, nombre: string): CatalogoExterno | null {
  return baseUrl ? new HttpCatalogoExterno({ baseUrl, apiKey, nombre }) : null;
}
