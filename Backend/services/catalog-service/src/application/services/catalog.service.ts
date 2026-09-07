import { z, ZodError } from 'zod';
import { DomainError } from '../../domain/errors/domain-error';
import {
  BuscarResult,
  CargarClasesCSVResult,
  CatalogRepository,
  ActualizarClaseInput,
  ClaseCSVInput,
  PublicarClaseInput,
  RegistrarCursoInput,
  RegistrarSemestreInput,
  ActualizarSemestreInput,
  RegistrarEscuelaInput,
  ActualizarEscuelaInput,
  ActualizarCursoInput,
  SearchCriteria,
  RegistrarMaterialInput,
  AgregarVersionMaterialInput,
  EliminarMaterialResult,
  CrearCapituloInput,
  ActualizarCapituloInput,
  CrearDudaInput,
  ResponderDudaInput,
  MarcarRespuestaVerificadaInput,
} from '../ports/catalog-repository';
import {
  Capitulo,
  ClaseDetalle,
  CursoAdmin,
  CursoCatalogo,
  DudaForo,
  EscuelaAdmin,
  MaterialAdjunto,
  RespuestaDuda,
  SemestreAdmin,
  SemestreResumen,
} from '../../domain/entities/clase';
import {
  claseCSVSchema,
  publicarClaseSchema,
  actualizarClaseSchema,
  registrarCursoSchema,
  searchSchema,
  registrarSemestreSchema,
  actualizarSemestreSchema,
  registrarEscuelaSchema,
  actualizarEscuelaSchema,
  actualizarCursoSchema,
  registrarMaterialSchema,
  agregarVersionMaterialSchema,
  crearCapituloSchema,
  actualizarCapituloSchema,
  crearDudaSchema,
  responderDudaSchema,
  marcarRespuestaVerificadaSchema,
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

function traducirErrorCapitulo(err: any): never {
  if (err instanceof DomainError) {
    throw err;
  }
  const message = String(err?.message ?? '');
  if (message.includes('CAPITULO_NO_ENCONTRADO')) {
    throw new DomainError('CAPITULO_NO_ENCONTRADO', 'Capitulo no encontrado', 404);
  }
  if (message.includes('CLASE_NO_ENCONTRADA')) {
    throw new DomainError('CLASE_NO_ENCONTRADA', 'Clase no encontrada', 404);
  }
  if (message.includes('CONFLICTO') || message.includes('duplicate key')) {
    throw new DomainError('CONFLICTO', 'El rango u orden del capitulo entra en conflicto con otro capitulo', 409);
  }
  if (message.includes('ENTRADA_INVALIDA')) {
    throw new DomainError('ENTRADA_INVALIDA', message.replace(/^.*ENTRADA_INVALIDA:\s*/, ''), 400);
  }
  throw err;
}

function traducirErrorDuda(err: any): never {
  if (err instanceof DomainError) {
    throw err;
  }
  const message = String(err?.message ?? '');
  if (message.includes('DUDA_NO_ENCONTRADA')) {
    throw new DomainError('DUDA_NO_ENCONTRADA', 'La duda no existe', 404);
  }
  if (message.includes('RESPUESTA_NO_ENCONTRADA')) {
    throw new DomainError('RESPUESTA_NO_ENCONTRADA', 'La respuesta no existe', 404);
  }
  if (message.includes('CLASE_NO_ENCONTRADA')) {
    throw new DomainError('CLASE_NO_ENCONTRADA', 'Clase no encontrada', 404);
  }
  if (message.includes('ENTRADA_INVALIDA')) {
    throw new DomainError('ENTRADA_INVALIDA', message.replace(/^.*ENTRADA_INVALIDA:\s*/, ''), 400);
  }
  throw err;
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

  async actualizarClase(raw: ActualizarClaseInput): Promise<ClaseDetalle> {
    const input = parse(actualizarClaseSchema, raw);
    const clase = await this.repository.actualizarClase({
      ...input,
      urlVideo: input.urlVideo ?? '',
    });
    if (!clase) {
      throw new DomainError('CLASE_NO_ENCONTRADA', 'Clase no encontrada', 404);
    }
    return clase;
  }

  async eliminarClase(claseId: string): Promise<void> {
    if (!claseId) {
      throw new DomainError('ENTRADA_INVALIDA', 'claseId es obligatorio', 400);
    }
    return this.repository.eliminarClase(claseId);
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

  // ---- Materiales adjuntos (Fase 2) ----

  async registrarMaterial(raw: RegistrarMaterialInput): Promise<MaterialAdjunto> {
    const input = parse(registrarMaterialSchema, raw);
    const material = await this.repository.registrarMaterial(input);
    if (!material) {
      throw new DomainError('ENTRADA_INVALIDA', 'No se pudo registrar el material', 400);
    }
    return material;
  }

  async obtenerMaterial(materialId: string): Promise<MaterialAdjunto> {
    if (!materialId) {
      throw new DomainError('ENTRADA_INVALIDA', 'materialId es obligatorio', 400);
    }
    const material = await this.repository.obtenerMaterial(materialId);
    if (!material) {
      throw new DomainError('MATERIAL_NO_ENCONTRADO', 'Material no encontrado', 404);
    }
    return material;
  }

  async agregarVersionMaterial(raw: AgregarVersionMaterialInput): Promise<MaterialAdjunto> {
    const input = parse(agregarVersionMaterialSchema, raw);
    try {
      return await this.repository.agregarVersionMaterial(input);
    } catch (err: any) {
      if (String(err?.message ?? '').includes('MATERIAL_NO_ENCONTRADO')) {
        throw new DomainError('MATERIAL_NO_ENCONTRADO', 'Material no encontrado', 404);
      }
      throw err;
    }
  }

  async listarMateriales(claseId: string): Promise<MaterialAdjunto[]> {
    if (!claseId) {
      throw new DomainError('ENTRADA_INVALIDA', 'claseId es obligatorio', 400);
    }
    return this.repository.listarMateriales(claseId);
  }

  async eliminarMaterial(materialId: string): Promise<EliminarMaterialResult> {
    if (!materialId) {
      throw new DomainError('ENTRADA_INVALIDA', 'materialId es obligatorio', 400);
    }
    const result = await this.repository.eliminarMaterial(materialId);
    if (!result.eliminado) {
      throw new DomainError('MATERIAL_NO_ENCONTRADO', 'Material no encontrado', 404);
    }
    return result;
  }

  async registrarDescargaMaterial(materialId: string): Promise<number> {
    if (!materialId) {
      throw new DomainError('ENTRADA_INVALIDA', 'materialId es obligatorio', 400);
    }
    try {
      return await this.repository.registrarDescargaMaterial(materialId);
    } catch (err: any) {
      if (String(err?.message ?? '').includes('MATERIAL_NO_ENCONTRADO')) {
        throw new DomainError('MATERIAL_NO_ENCONTRADO', 'Material no encontrado', 404);
      }
      throw err;
    }
  }

  // ---- Segmentación por capítulos y temas ----

  async listarCapitulos(claseId: string): Promise<Capitulo[]> {
    if (!claseId) {
      throw new DomainError('ENTRADA_INVALIDA', 'claseId es obligatorio', 400);
    }
    return this.repository.listarCapitulos(claseId);
  }

  async crearCapitulo(raw: CrearCapituloInput): Promise<Capitulo> {
    const input = parse(crearCapituloSchema, raw);
    try {
      return await this.repository.crearCapitulo(input);
    } catch (err: any) {
      traducirErrorCapitulo(err);
    }
  }

  async actualizarCapitulo(raw: ActualizarCapituloInput): Promise<Capitulo> {
    const input = parse(actualizarCapituloSchema, raw);
    try {
      const capitulo = await this.repository.actualizarCapitulo(input);
      if (!capitulo) {
        throw new DomainError('CAPITULO_NO_ENCONTRADO', 'Capitulo no encontrado', 404);
      }
      return capitulo;
    } catch (err: any) {
      if (err instanceof DomainError) throw err;
      traducirErrorCapitulo(err);
    }
  }

  async eliminarCapitulo(capituloId: string): Promise<{ eliminado: boolean; claseId: string | null }> {
    if (!capituloId) {
      throw new DomainError('ENTRADA_INVALIDA', 'capituloId es obligatorio', 400);
    }
    try {
      const result = await this.repository.eliminarCapitulo(capituloId);
      if (!result.eliminado) {
        throw new DomainError('CAPITULO_NO_ENCONTRADO', 'Capitulo no encontrado', 404);
      }
      return result;
    } catch (err: any) {
      if (err instanceof DomainError) throw err;
      traducirErrorCapitulo(err);
    }
  }

  // ---- Foro de dudas anclado al minuto del video ----

  async crearDuda(raw: CrearDudaInput): Promise<DudaForo> {
    const input = parse(crearDudaSchema, raw);
    try {
      const duda = await this.repository.crearDuda(input);
      if (!duda) {
        throw new DomainError('ENTRADA_INVALIDA', 'No se pudo crear la duda', 400);
      }
      return duda;
    } catch (err: any) {
      traducirErrorDuda(err);
    }
  }

  async listarDudas(claseId: string): Promise<DudaForo[]> {
    if (!claseId) {
      throw new DomainError('ENTRADA_INVALIDA', 'claseId es obligatorio', 400);
    }
    return this.repository.listarDudas(claseId);
  }

  async responderDuda(raw: ResponderDudaInput): Promise<RespuestaDuda> {
    const input = parse(responderDudaSchema, raw);
    try {
      const respuesta = await this.repository.responderDuda(input);
      if (!respuesta) {
        throw new DomainError('ENTRADA_INVALIDA', 'No se pudo registrar la respuesta', 400);
      }
      return respuesta;
    } catch (err: any) {
      traducirErrorDuda(err);
    }
  }

  async marcarRespuestaVerificada(raw: MarcarRespuestaVerificadaInput): Promise<DudaForo> {
    const input = parse(marcarRespuestaVerificadaSchema, raw);

    const respuesta = await this.repository.obtenerRespuesta(input.respuestaId);
    if (!respuesta) {
      throw new DomainError('RESPUESTA_NO_ENCONTRADA', 'La respuesta no existe', 404);
    }
    const duda = await this.repository.obtenerDuda(respuesta.dudaId);
    if (!duda) {
      throw new DomainError('DUDA_NO_ENCONTRADA', 'La duda no existe', 404);
    }

    // Solo el autor de la duda o el personal docente (catedrático/auxiliar/admin).
    const esAutor = duda.autorId === input.verificadorId;
    if (!esAutor && !input.puedeVerificarComoDocente) {
      throw new DomainError(
        'SIN_AUTORIZACION',
        'Solo el autor de la duda o el personal docente puede marcar la respuesta como verificada',
        403,
      );
    }

    try {
      const actualizada = await this.repository.marcarRespuestaVerificada(
        respuesta.respuestaId,
        input.verificadorId,
      );
      if (!actualizada) {
        throw new DomainError('RESPUESTA_NO_ENCONTRADA', 'La respuesta no existe', 404);
      }
      const hiloActualizado = await this.repository.obtenerDuda(respuesta.dudaId);
      if (!hiloActualizado) {
        throw new DomainError('DUDA_NO_ENCONTRADA', 'La duda no existe', 404);
      }
      return hiloActualizado;
    } catch (err: any) {
      traducirErrorDuda(err);
    }
  }
}
