export interface CursoInscripcion {
  cursoId: string;
  codigo: string;
  nombre: string;
  escuela: string;
  semestre: string;
  anio: number;
}

export interface PanelEstudianteItem {
  cursoId: string;
  codigo: string;
  curso: string;
  escuela: string;
  semestre: string;
  anio: number;
  estadoMatricula: string;
  catedraticoUsuarioId: string | null;
}

export interface CursoCatedraticoItem {
  cursoId: string;
  codigo: string;
  curso: string;
  semestre: string;
  anio: number;
  auxiliares: string[];
}

export interface DocenteInscripcion {
  docenteId: string;
  usuarioId: string;
}

export interface AuxiliarInscripcion {
  auxiliarId: string;
  usuarioId: string;
}

export interface AsignacionDocenteItem {
  asignacionId: string;
  docenteId: string;
  docenteUsuarioId: string;
  cursoId: string;
  codigo: string;
  curso: string;
  semestre: string;
  anio: number;
  auxiliarId: string | null;
  auxiliarUsuarioId: string | null;
}
