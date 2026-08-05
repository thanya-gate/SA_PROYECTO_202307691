import {
  CursoCatedraticoItem,
  CursoInscripcion,
  PanelEstudianteItem,
} from '../../domain/entities/inscripcion';

export interface RegistrarCursoInput {
  codigo: string;
  nombre: string;
  escuela: string;
  semestre: string;
  anio: number;
}

export interface RegistrarDocenteInput {
  usuarioId: string;
}

export interface RegistrarAuxiliarInput {
  usuarioId: string;
}

export interface InscribirEstudianteInput {
  estudianteId: string;
  cursoId: string;
  semestre: string;
}

export interface AsignarCatedraticoCursoInput {
  docenteId: string;
  cursoId: string;
  semestre: string;
}

export interface AsignarAuxiliarCatedraticoInput {
  auxiliarId: string;
  asignacionDocenteId: string;
}

export interface InscripcionRepository {
  registrarCurso(input: RegistrarCursoInput): Promise<CursoInscripcion>;
  registrarDocente(input: RegistrarDocenteInput): Promise<{ docenteId: string }>;
  registrarAuxiliar(input: RegistrarAuxiliarInput): Promise<{ auxiliarId: string }>;
  inscribirEstudiante(
    input: InscribirEstudianteInput,
  ): Promise<{ inscripcionId: string; estadoMatricula: string }>;
  asignarCatedraticoCurso(
    input: AsignarCatedraticoCursoInput,
  ): Promise<{ asignacionId: string }>;
  asignarAuxiliarCatedratico(
    input: AsignarAuxiliarCatedraticoInput,
  ): Promise<{ asignacionAuxiliarId: string }>;
  consultarPanelEstudiante(estudianteId: string): Promise<PanelEstudianteItem[]>;
  consultarCursosCatedratico(catedraticoUsuarioId: string): Promise<CursoCatedraticoItem[]>;
  consultarEstadoMatricula(estudianteId: string, cursoId: string): Promise<string>;
}
