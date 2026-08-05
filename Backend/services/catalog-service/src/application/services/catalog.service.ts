import { z, ZodError } from 'zod';
import { DomainError } from '../../domain/errors/domain-error';
import {
  CatalogRepository,
  PublicarClaseInput,
  RegistrarCursoInput,
  SearchCriteria,
} from '../ports/catalog-repository';
import {
  ClaseDetalle,
  ClaseResumen,
  CursoCatalogo,
  SemestreResumen,
} from '../../domain/entities/clase';
import { publicarClaseSchema, registrarCursoSchema, searchSchema } from '../dto/catalog-schemas';

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

  async search(raw: SearchCriteria): Promise<ClaseResumen[]> {
    const input = parse(searchSchema, raw);
    return this.repository.buscar(input);
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

  async publicarClase(raw: PublicarClaseInput): Promise<{ claseId: string; fechaPublicacion: string }> {
    const input = parse(publicarClaseSchema, raw);
    return this.repository.publicarClase(input);
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
}
