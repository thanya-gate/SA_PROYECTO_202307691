// Traduce el catálogo interno (gRPC) al contrato público de federación
// (openapi/federacion.yaml). Solo expone datos públicos de la clase.

export interface CapituloFederado {
  titulo: string;
  inicioSeg: number;
  finSeg: number;
}

export interface ClaseFederada {
  id: string;
  titulo: string;
  curso: string;
  codigoCurso?: string;
  unidad?: string;
  semestre?: string;
  anio?: number;
  catedratico?: string;
  duracionSeg?: number;
  videoUrl: string;
  tipoVideo: 'archivo' | 'youtube';
  notasMd?: string;
  capitulos: CapituloFederado[];
  origen: { grupo: string; institucion: string };
}

export interface OpcionesMapeo {
  grupo: string;
  institucion: string;
  baseUrl: string;
}

const YOUTUBE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)[\w-]{6,}/;

export function urlAbsoluta(url: string, baseUrl: string): string {
  if (!url || /^https?:\/\//i.test(url)) return url;
  return `${baseUrl.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

export function aClaseFederada(clase: any, opciones: OpcionesMapeo): ClaseFederada {
  const videoUrl = urlAbsoluta(String(clase.urlVideo ?? ''), opciones.baseUrl);
  const catedratico = (clase.participantes ?? []).find(
    (p: any) => String(p.rol ?? '').toUpperCase() === 'CATEDRATICO',
  );
  return {
    id: String(clase.claseId),
    titulo: String(clase.tema ?? ''),
    curso: String(clase.curso ?? ''),
    codigoCurso: clase.codigo || undefined,
    unidad: clase.unidad || undefined,
    semestre: clase.semestre || undefined,
    anio: clase.anio || undefined,
    catedratico: catedratico?.nombre || undefined,
    duracionSeg: clase.duracion || undefined,
    videoUrl,
    tipoVideo: YOUTUBE.test(videoUrl) ? 'youtube' : 'archivo',
    notasMd: '',
    capitulos: [...(clase.capitulos ?? [])]
      .sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0))
      .map((c: any) => ({
        titulo: String(c.titulo ?? ''),
        inicioSeg: Number(c.inicioSegundos ?? 0),
        finSeg: Number(c.finSegundos ?? 0),
      })),
    origen: { grupo: opciones.grupo, institucion: opciones.institucion },
  };
}
