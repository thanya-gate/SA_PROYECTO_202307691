import { apiFetch, ApiError } from './http';
import { config } from '../config/env';

export interface SemestreAdminItem {
  semestreId: string;
  nombre: string;
  anio: number;
  clases: number;
}

export interface EscuelaAdminItem {
  escuelaId: string;
  nombre: string;
  cursos: number;
}

export interface CursoAdminItem {
  cursoId: string;
  codigo: string;
  nombre: string;
  escuela: string;
}

export interface DocenteAdminItem {
  docenteId: string;
  usuarioId: string;
}

export interface CargaCsvResult {
  message: string;
  registradas: number;
  omitidas: number;
  totalProcesadas: number;
}

interface ListaSemestresResponse {
  semestres: SemestreAdminItem[];
}

interface ListaEscuelasResponse {
  escuelas: EscuelaAdminItem[];
}

interface ListaCursosResponse {
  cursos: CursoAdminItem[];
}

interface ListaDocentesResponse {
  docentes: DocenteAdminItem[];
}

async function uploadCsv(csvText: string, token: string): Promise<CargaCsvResult> {
  const response = await fetch(`${config.apiBaseUrl}/admin/catalogo/csv`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/csv',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: csvText,
    credentials: 'include',
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const envelope = data as { error?: { code?: string; message?: string } };
    throw new ApiError(
      response.status,
      envelope?.error?.code ?? 'ERROR_DESCONOCIDO',
      envelope?.error?.message ?? `Error del servidor (${response.status})`,
    );
  }

  return data as CargaCsvResult;
}

export const adminApi = {
  listarSemestres: (token: string): Promise<ListaSemestresResponse> =>
    apiFetch<ListaSemestresResponse>('/admin/semestres', { token }),

  registrarSemestre: (token: string, nombre: string, anio: number): Promise<{ semestreId: string }> =>
    apiFetch<{ semestreId: string }>('/admin/semestres', { method: 'POST', body: { nombre, anio }, token }),

  actualizarSemestre: (token: string, semestreId: string, nombre: string, anio: number): Promise<{ message: string }> =>
    apiFetch<{ message: string }>(`/admin/semestres/${semestreId}`, { method: 'PATCH', body: { nombre, anio }, token }),

  eliminarSemestre: (token: string, semestreId: string): Promise<{ message: string }> =>
    apiFetch<{ message: string }>(`/admin/semestres/${semestreId}`, { method: 'DELETE', token }),

  listarEscuelas: (token: string): Promise<ListaEscuelasResponse> =>
    apiFetch<ListaEscuelasResponse>('/admin/escuelas', { token }),

  registrarEscuela: (token: string, nombre: string): Promise<{ escuelaId: string }> =>
    apiFetch<{ escuelaId: string }>('/admin/escuelas', { method: 'POST', body: { nombre }, token }),

  actualizarEscuela: (token: string, escuelaId: string, nombre: string): Promise<{ message: string }> =>
    apiFetch<{ message: string }>(`/admin/escuelas/${escuelaId}`, { method: 'PATCH', body: { nombre }, token }),

  eliminarEscuela: (token: string, escuelaId: string): Promise<{ message: string }> =>
    apiFetch<{ message: string }>(`/admin/escuelas/${escuelaId}`, { method: 'DELETE', token }),

  listarCursos: (token: string): Promise<ListaCursosResponse> =>
    apiFetch<ListaCursosResponse>('/admin/cursos', { token }),

  registrarCurso: (token: string, input: { codigo: string; nombre: string; escuela: string }): Promise<{ curso: CursoAdminItem }> =>
    apiFetch<{ curso: CursoAdminItem }>('/admin/cursos', { method: 'POST', body: input, token }),

  actualizarCurso: (
    token: string,
    cursoId: string,
    input: { codigo: string; nombre: string; escuela: string },
  ): Promise<{ message: string }> =>
    apiFetch<{ message: string }>(`/admin/cursos/${cursoId}`, { method: 'PATCH', body: input, token }),

  eliminarCurso: (token: string, cursoId: string): Promise<{ message: string }> =>
    apiFetch<{ message: string }>(`/admin/cursos/${cursoId}`, { method: 'DELETE', token }),

  listarDocentes: (token: string): Promise<ListaDocentesResponse> =>
    apiFetch<ListaDocentesResponse>('/admin/docentes', { token }),

  registrarDocente: (token: string, usuarioId: string): Promise<{ docenteId: string }> =>
    apiFetch<{ docenteId: string }>('/admin/docentes', { method: 'POST', body: { usuarioId }, token }),

  eliminarDocente: (token: string, docenteId: string): Promise<{ message: string }> =>
    apiFetch<{ message: string }>(`/admin/docentes/${docenteId}`, { method: 'DELETE', token }),

  cargarCsv: (token: string, csvText: string): Promise<CargaCsvResult> => uploadCsv(csvText, token),
};
