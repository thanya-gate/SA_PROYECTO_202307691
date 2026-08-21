import { z, ZodError } from 'zod';
import { DomainError } from '../../domain/errors/domain-error';
import {
  InscripcionRepository,
  RegistrarCursoInput,
  RegistrarDocenteInput,
  RegistrarAuxiliarInput,
  InscribirEstudianteInput,
  AsignarCatedraticoCursoInput,
  AsignarAuxiliarCatedraticoInput,
} from '../ports/inscripcion-repository';
import {
  AsignacionDocenteItem,
  AuxiliarInscripcion,
  CursoCatedraticoItem,
  CursoInscripcion,
  DocenteInscripcion,
  PanelEstudianteItem,
} from '../../domain/entities/inscripcion';
import {
  registrarCursoSchema,
  registrarDocenteSchema,
  registrarAuxiliarSchema,
  inscribirEstudianteSchema,
  asignarCatedraticoCursoSchema,
  asignarAuxiliarCatedraticoSchema,
} from '../dto/inscripcion-schemas';

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

export class InscripcionService {
  constructor(private readonly repository: InscripcionRepository) {}

  async registrarCurso(raw: RegistrarCursoInput): Promise<CursoInscripcion> {
    const input = parse(registrarCursoSchema, raw);
    return this.repository.registrarCurso(input);
  }

  async registrarDocente(raw: RegistrarDocenteInput): Promise<{ docenteId: string }> {
    const input = parse(registrarDocenteSchema, raw);
    return this.repository.registrarDocente(input);
  }

  async registrarAuxiliar(raw: RegistrarAuxiliarInput): Promise<{ auxiliarId: string }> {
    const input = parse(registrarAuxiliarSchema, raw);
    return this.repository.registrarAuxiliar(input);
  }

  async inscribirEstudiante(
    raw: InscribirEstudianteInput,
  ): Promise<{ inscripcionId: string; estadoMatricula: string }> {
    const input = parse(inscribirEstudianteSchema, raw);
    return this.repository.inscribirEstudiante(input);
  }

  async asignarCatedraticoCurso(
    raw: AsignarCatedraticoCursoInput,
  ): Promise<{ asignacionId: string }> {
    const input = parse(asignarCatedraticoCursoSchema, raw);
    return this.repository.asignarCatedraticoCurso(input);
  }

  async asignarAuxiliarCatedratico(
    raw: AsignarAuxiliarCatedraticoInput,
  ): Promise<{ asignacionAuxiliarId: string }> {
    const input = parse(asignarAuxiliarCatedraticoSchema, raw);
    return this.repository.asignarAuxiliarCatedratico(input);
  }

  async consultarPanelEstudiante(estudianteId: string): Promise<PanelEstudianteItem[]> {
    if (!estudianteId) {
      throw new DomainError('ENTRADA_INVALIDA', 'estudianteId es obligatorio', 400);
    }
    return this.repository.consultarPanelEstudiante(estudianteId);
  }

  async consultarCursosCatedratico(catedraticoUsuarioId: string): Promise<CursoCatedraticoItem[]> {
    if (!catedraticoUsuarioId) {
      throw new DomainError('ENTRADA_INVALIDA', 'catedraticoUsuarioId es obligatorio', 400);
    }
    return this.repository.consultarCursosCatedratico(catedraticoUsuarioId);
  }

  async consultarEstadoMatricula(estudianteId: string, cursoId: string): Promise<string> {
    if (!estudianteId || !cursoId) {
      throw new DomainError('ENTRADA_INVALIDA', 'estudianteId y cursoId son obligatorios', 400);
    }
    return this.repository.consultarEstadoMatricula(estudianteId, cursoId);
  }

  async listarCursos(): Promise<CursoInscripcion[]> {
    return this.repository.listarCursos();
  }

  async listarDocentes(): Promise<DocenteInscripcion[]> {
    return this.repository.listarDocentes();
  }

  async listarAuxiliares(): Promise<AuxiliarInscripcion[]> {
    return this.repository.listarAuxiliares();
  }

  async listarAsignaciones(): Promise<AsignacionDocenteItem[]> {
    return this.repository.listarAsignaciones();
  }

  async listarEstudiantesDeCurso(cursoId: string, semestre: string): Promise<string[]> {
    if (!cursoId || !semestre) {
      throw new DomainError('ENTRADA_INVALIDA', 'cursoId y semestre son obligatorios', 400);
    }
    return this.repository.listarEstudiantesDeCurso(cursoId, semestre);
  }

  async eliminarDocente(docenteId: string): Promise<void> {
    if (!docenteId) {
      throw new DomainError('ENTRADA_INVALIDA', 'docenteId es obligatorio', 400);
    }
    return this.repository.eliminarDocente(docenteId);
  }
}
