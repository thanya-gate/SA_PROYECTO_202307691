import { apiFetch } from './http';

export interface PanelEstudianteItem {
  cursoId: string;
  codigo: string;
  curso: string;
  escuela: string;
  semestre: string;
  anio: number;
  estadoMatricula: string;
  catedraticoUsuarioId: string;
}

export interface CursoCatedraticoItem {
  cursoId: string;
  codigo: string;
  curso: string;
  semestre: string;
  anio: number;
  auxiliares: string[];
}

export interface CursoRegistrado {
  cursoId: string;
  codigo: string;
  nombre: string;
  escuela: string;
  semestre: string;
  anio: number;
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

export interface RegistrarCursoInput {
  codigo: string;
  nombre: string;
  escuela: string;
  semestre: string;
  anio: number;
}

interface PanelEstudianteResponse {
  items: PanelEstudianteItem[];
}

interface CursosCatedraticoResponse {
  items: CursoCatedraticoItem[];
}

interface EstadoMatriculaResponse {
  estado: string;
}

interface RegistrarCursoResponse {
  message: string;
  curso: CursoRegistrado;
}

interface RegistrarDocenteResponse {
  message: string;
  docenteId: string;
}

interface RegistrarAuxiliarResponse {
  message: string;
  auxiliarId: string;
}

interface InscribirEstudianteResponse {
  message: string;
  inscripcionId: string;
  estadoMatricula: string;
}

interface AsignarCatedraticoCursoResponse {
  message: string;
  asignacionId: string;
}

interface AsignarDocenteCursoResponse {
  message: string;
  docenteId: string;
  asignacionId: string;
}

interface AsignarAuxiliarCatedraticoResponse {
  message: string;
  asignacionAuxiliarId: string;
}

interface ListarCursosResponse {
  cursos: CursoRegistrado[];
}

interface ListarDocentesResponse {
  docentes: DocenteInscripcion[];
}

interface ListarAuxiliaresResponse {
  auxiliares: AuxiliarInscripcion[];
}

interface ListarAsignacionesResponse {
  asignaciones: AsignacionDocenteItem[];
}

export const inscripcionApi = {
  panelEstudiante: (token: string, estudianteId?: string): Promise<PanelEstudianteResponse> =>
    apiFetch<PanelEstudianteResponse>(
      `/inscripcion/panel/me${estudianteId ? `?estudianteId=${encodeURIComponent(estudianteId)}` : ''}`,
      { token },
    ),

  cursosCatedratico: (token: string, catedraticoId?: string): Promise<CursosCatedraticoResponse> =>
    apiFetch<CursosCatedraticoResponse>(
      `/inscripcion/cursos-catedratico${catedraticoId ? `?catedraticoId=${encodeURIComponent(catedraticoId)}` : ''}`,
      { token },
    ),

  estadoMatricula: (token: string, cursoId: string): Promise<EstadoMatriculaResponse> =>
    apiFetch<EstadoMatriculaResponse>(`/inscripcion/estado-matricula/${cursoId}`, { token }),

  registrarCurso: (token: string, input: RegistrarCursoInput): Promise<RegistrarCursoResponse> =>
    apiFetch<RegistrarCursoResponse>('/inscripcion/cursos', { method: 'POST', body: input, token }),

  registrarDocente: (token: string, usuarioId: string): Promise<RegistrarDocenteResponse> =>
    apiFetch<RegistrarDocenteResponse>('/inscripcion/docentes', { method: 'POST', body: { usuarioId }, token }),

  registrarAuxiliar: (token: string, usuarioId: string): Promise<RegistrarAuxiliarResponse> =>
    apiFetch<RegistrarAuxiliarResponse>('/inscripcion/auxiliares', { method: 'POST', body: { usuarioId }, token }),

  inscribirEstudiante: (
    token: string,
    estudianteId: string,
    cursoId: string,
    semestre: string,
  ): Promise<InscribirEstudianteResponse> =>
    apiFetch<InscribirEstudianteResponse>(`/inscripcion/estudiantes/${estudianteId}/cursos/${cursoId}`, {
      method: 'POST',
      body: { semestre },
      token,
    }),

  asignarCatedraticoCurso: (
    token: string,
    docenteId: string,
    cursoId: string,
    semestre: string,
  ): Promise<AsignarCatedraticoCursoResponse> =>
    apiFetch<AsignarCatedraticoCursoResponse>(`/inscripcion/catedraticos/${docenteId}/cursos/${cursoId}`, {
      method: 'POST',
      body: { semestre },
      token,
    }),

  asignarDocenteCurso: (
    token: string,
    usuarioId: string,
    cursoId: string,
    semestre: string,
  ): Promise<AsignarDocenteCursoResponse> =>
    apiFetch<AsignarDocenteCursoResponse>(`/inscripcion/cursos/${cursoId}/docente`, {
      method: 'POST',
      body: { usuarioId, semestre },
      token,
    }),

  asignarAuxiliarCatedratico: (
    token: string,
    auxiliarId: string,
    asignacionDocenteId: string,
  ): Promise<AsignarAuxiliarCatedraticoResponse> =>
    apiFetch<AsignarAuxiliarCatedraticoResponse>(
      `/inscripcion/auxiliares/${auxiliarId}/asignaciones/${asignacionDocenteId}`,
      { method: 'POST', token },
    ),

  listarCursos: (token: string): Promise<ListarCursosResponse> =>
    apiFetch<ListarCursosResponse>('/inscripcion/cursos', { token }),

  listarDocentes: (token: string): Promise<ListarDocentesResponse> =>
    apiFetch<ListarDocentesResponse>('/inscripcion/docentes', { token }),

  listarAuxiliares: (token: string): Promise<ListarAuxiliaresResponse> =>
    apiFetch<ListarAuxiliaresResponse>('/inscripcion/auxiliares', { token }),

  listarAsignaciones: (token: string): Promise<ListarAsignacionesResponse> =>
    apiFetch<ListarAsignacionesResponse>('/inscripcion/asignaciones', { token }),

  autoInscribirse: (token: string, cursoId: string, semestre: string): Promise<InscribirEstudianteResponse> =>
    apiFetch<InscribirEstudianteResponse>('/inscripcion/inscripciones/auto', {
      method: 'POST',
      body: { cursoId, semestre },
      token,
    }),
};
