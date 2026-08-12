import { z, ZodError } from 'zod';
import { DomainError } from '../../domain/errors/domain-error';
import {
  BuscarResult,
  CargarClasesCSVResult,
  CatalogRepository,
  ClaseCSVInput,
  PublicarClaseInput,
  RegistrarCursoInput,
  RegistrarSemestreInput,
  ActualizarSemestreInput,
  RegistrarEscuelaInput,
  ActualizarEscuelaInput,
  ActualizarCursoInput,
  SearchCriteria,
} from '../ports/catalog-repository';
import {
  ClaseDetalle,
  CursoAdmin,
  CursoCatalogo,
  EscuelaAdmin,
  SemestreAdmin,
  SemestreResumen,
} from '../../domain/entities/clase';
import {
  claseCSVSchema,
  publicarClaseSchema,
  registrarCursoSchema,
  searchSchema,
  registrarSemestreSchema,
  actualizarSemestreSchema,
  registrarEscuelaSchema,
  actualizarEscuelaSchema,
  actualizarCursoSchema,
} from '../dto/catalog-schemas';

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new DomainError('ENTRADA_INVALIDA', 'Datos de entrada inválidos', 400, err.flatten().fieldErrors);
    }
    throw err;
  }
}


export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  async search(raw: SearchCriteria): Promise<BuscarResult> {
    const input = parse(searchSchema, raw);
    return this.repository.buscar(input);
  }

  async cargarClasesCSV(raw: ClaseCSVInput[]): Promise<CargarClasesCSVResult> {
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new DomainError('ENTRADA_INVALIDA', 'No se recibieron filas CSV que procesar', 400);
    }
    const clases = raw.map((r) => parse(claseCSVSchema, r));
    return this.repository.cargarClasesCSV(clases);
  }

  async getClase(claseId: string): Promise<ClaseDetalle> {
    const clase = await this.repository.getClase(claseId);
    if (!clase) {
      throw new DomainError('CLASE_NO_ENCONTRADA', 'Clase no encontrada', 404);
    }
    return clase;
  }

  async listarPorSemestre(semestre?: string): Promise<SemestreResumen[]> {
    return this.repository.listarPorSemestre(semestre || undefined);
  }

  async obtenerCursoPorCodigo(codigo: string): Promise<CursoCatalogo> {
    const curso = await this.repository.buscarCursoPorCodigo(codigo);
    if (!curso) {
      throw new DomainError('CURSO_NO_ENCONTRADO', 'Curso no encontrado en el catálogo', 404);
    }
    return curso;
  }

  async publicarClase(raw: PublicarClaseInput): Promise<{ claseId: string; fechaPublicacion: string }> {
    const input = parse(publicarClaseSchema, raw);
    return this.repository.publicarClase({ ...input, urlVideo: input.urlVideo ?? '' });
  }

  async actualizarUrlMaterial(claseId: string, urlMaterial: string): Promise<ClaseDetalle> {
    if (!urlMaterial || urlMaterial.trim().length === 0) {
      throw new DomainError('ENTRADA_INVALIDA', 'url_material es obligatorio', 400);
    }
    const clase = await this.repository.actualizarUrlMaterial(claseId, urlMaterial.trim());
    if (!clase) {
      throw new DomainError('CLASE_NO_ENCONTRADA', 'Clase no encontrada', 404);
    }
    return clase;
  }

  async registrarCurso(raw: RegistrarCursoInput): Promise<CursoCatalogo> {
    const input = parse(registrarCursoSchema, raw);
    return this.repository.registrarCurso(input);
  }

  async actualizarUrlVideo(claseId: string, urlVideo: string): Promise<ClaseDetalle> {
    if (!urlVideo || urlVideo.trim().length === 0) {
      throw new DomainError('ENTRADA_INVALIDA', 'url_video es obligatorio', 400);
    }
    const clase = await this.repository.actualizarUrlVideo(claseId, urlVideo.trim());
    if (!clase) {
      throw new DomainError('CLASE_NO_ENCONTRADA', 'Clase no encontrada', 404);
    }
    return clase;
  }

  async actualizarDuracion(claseId: string, duracion: number): Promise<ClaseDetalle> {
    if (!Number.isInteger(duracion) || duracion <= 0) {
      throw new DomainError('ENTRADA_INVALIDA', 'duracion debe ser un entero positivo', 400);
    }
    const clase = await this.repository.actualizarDuracion(claseId, duracion);
    if (!clase) {
      throw new DomainError('CLASE_NO_ENCONTRADA', 'Clase no encontrada', 404);
    }
    return clase;
  }

  async listarSemestres(): Promise<SemestreAdmin[]> {
    return this.repository.listarSemestres();
  }

  async registrarSemestre(raw: RegistrarSemestreInput): Promise<{ semestreId: string }> {
    const input = parse(registrarSemestreSchema, raw);
    return this.repository.registrarSemestre(input);
  }

  async actualizarSemestre(raw: ActualizarSemestreInput): Promise<void> {
    const input = parse(actualizarSemestreSchema, raw);
    return this.repository.actualizarSemestre(input);
  }

  async eliminarSemestre(semestreId: string): Promise<void> {
    if (!semestreId) {
      throw new DomainError('ENTRADA_INVALIDA', 'semestreId es obligatorio', 400);
    }
    return this.repository.eliminarSemestre(semestreId);
  }

  async listarEscuelas(): Promise<EscuelaAdmin[]> {
    return this.repository.listarEscuelas();
  }

  async registrarEscuela(raw: RegistrarEscuelaInput): Promise<{ escuelaId: string }> {
    const input = parse(registrarEscuelaSchema, raw);
    return this.repository.registrarEscuela(input);
  }

  async actualizarEscuela(raw: ActualizarEscuelaInput): Promise<void> {
    const input = parse(actualizarEscuelaSchema, raw);
    return this.repository.actualizarEscuela(input);
  }

  async eliminarEscuela(escuelaId: string): Promise<void> {
    if (!escuelaId) {
      throw new DomainError('ENTRADA_INVALIDA', 'escuelaId es obligatorio', 400);
    }
    return this.repository.eliminarEscuela(escuelaId);
  }

  async listarCursos(): Promise<CursoAdmin[]> {
    return this.repository.listarCursos();
  }

  async actualizarCurso(raw: ActualizarCursoInput): Promise<void> {
    const input = parse(actualizarCursoSchema, raw);
    return this.repository.actualizarCurso(input);
  }

  async eliminarCurso(cursoId: string): Promise<void> {
    if (!cursoId) {
      throw new DomainError('ENTRADA_INVALIDA', 'cursoId es obligatorio', 400);
    }
    return this.repository.eliminarCurso(cursoId);
  }
}
