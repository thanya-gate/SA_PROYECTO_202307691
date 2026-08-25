import { apiFetch } from './http';
import type { MaterialAdjunto } from './materiales';

export interface ClaseResumen {
  claseId: string;
  codigo: string;
  curso: string;
  unidad: string;
  tema: string;
  semestre: string;
  anio: number;
  urlVideo: string;
}

export interface Participante {
  nombre: string;
  rol: string;
}

export interface Capitulo {
  capituloId: string;
  claseId: string;
  titulo: string;
  inicioSegundos: number;
  finSegundos: number;
  orden: number;
  fechaCreacion: string;
  fechaActualizacion: string;
}

export interface ClaseDetalle {
  claseId: string;
  codigo: string;
  curso: string;
  escuela: string;
  unidad: string;
  tema: string;
  fechaImparticion: string;
  semestre: string;
  anio: number;
  duracion: number;
  urlVideo: string;
  urlMaterial: string;
  fechaPublicacion: string;
  participantes: Participante[];
  etiquetas: string[];
  materiales: MaterialAdjunto[];
  capitulos: Capitulo[];
}

export interface SemestreResumen {
  semestre: string;
  anio: number;
  escuela: string;
  totalClases: number;
}

export interface CursoCatalogo {
  cursoId: string;
  codigo: string;
  nombre: string;
  escuela: string;
}

export interface SearchParams {
  semestre?: string;
  escuela?: string;
  curso?: string;
  catedratico?: string;
  tema?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginaClases {
  resultados: ClaseResumen[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ParticipanteInput {
  nombre: string;
  rol: 'CATEDRATICO' | 'AUXILIAR';
}

export interface PublicarClaseInput {
  cursoId: string;
  unidad?: string;
  tema?: string;
  fechaImparticion?: string;
  semestre: string;
  anio: number;
  urlVideo?: string;
  urlMaterial?: string;
  duracion: number;
  etiquetas: string[];
  participantes: ParticipanteInput[];
}

export interface EditarClaseInput {
  cursoId: string;
  unidad: string;
  tema: string;
  fechaImparticion: string;
  semestre: string;
  anio: number;
  urlVideo: string;
  urlMaterial: string;
  duracion: number;
  etiquetas: string[];
  participantes: ParticipanteInput[];
}

export interface CrearCapituloInput {
  titulo: string;
  inicioSegundos: number;
  finSegundos: number;
  orden?: number;
}

export interface ActualizarCapituloInput extends CrearCapituloInput {
  claseId: string;
}

interface GetClaseResponse {
  clase: ClaseDetalle;
}

interface SemestresResponse {
  semestres: SemestreResumen[];
}

interface PublicarClaseResponse {
  message: string;
  claseId: string;
  fechaPublicacion: string;
}

function toQuery(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value === 'number') {
      query.set(key, String(value));
    } else if (value && value.trim().length > 0) {
      query.set(key, value.trim());
    }
  }
  const raw = query.toString();
  return raw.length > 0 ? `?${raw}` : '';
}

export const catalogApi = {
  search: (params: SearchParams, token: string): Promise<PaginaClases> =>
    apiFetch<PaginaClases>(`/catalog/classes${toQuery(params)}`, { token }),

  getClase: (claseId: string, token: string): Promise<GetClaseResponse> =>
    apiFetch<GetClaseResponse>(`/catalog/classes/${claseId}`, { token }),

  semestres: (semestre: string, token: string): Promise<SemestresResponse> =>
    apiFetch<SemestresResponse>(`/catalog/semestres${semestre ? `?semestre=${encodeURIComponent(semestre)}` : ''}`, {
      token,
    }),

  getCursoPorCodigo: (codigo: string, token: string): Promise<{ curso: CursoCatalogo }> =>
    apiFetch<{ curso: CursoCatalogo }>(`/catalog/courses/${encodeURIComponent(codigo)}`, { token }),

  publicarClase: (input: PublicarClaseInput, token: string): Promise<PublicarClaseResponse> =>
    apiFetch<PublicarClaseResponse>('/catalog/classes', {
      method: 'POST',
      body: input,
      token,
    }),

  editarClase: (claseId: string, input: EditarClaseInput, token: string): Promise<{ message: string; clase: ClaseDetalle }> =>
    apiFetch<{ message: string; clase: ClaseDetalle }>(`/catalog/classes/${claseId}`, {
      method: 'PATCH',
      body: input,
      token,
    }),

  actualizarDuracion: (claseId: string, duracion: number, token: string): Promise<{ message: string; clase: ClaseDetalle }> =>
    apiFetch<{ message: string; clase: ClaseDetalle }>(`/catalog/classes/${claseId}/duracion`, {
      method: 'PATCH',
      body: { duracion },
      token,
    }),

  eliminarClase: (claseId: string, token: string): Promise<{ message: string }> =>
    apiFetch<{ message: string }>(`/catalog/classes/${claseId}`, {
      method: 'DELETE',
      token,
    }),

  listarCapitulos: (claseId: string, token: string): Promise<{ capitulos: Capitulo[] }> =>
    apiFetch<{ capitulos: Capitulo[] }>(`/catalog/classes/${claseId}/chapters`, { token }),

  crearCapitulo: (
    claseId: string,
    input: CrearCapituloInput,
    token: string,
  ): Promise<{ message: string; capitulo: Capitulo }> =>
    apiFetch<{ message: string; capitulo: Capitulo }>(`/catalog/classes/${claseId}/chapters`, {
      method: 'POST',
      body: input,
      token,
    }),

  actualizarCapitulo: (
    capituloId: string,
    input: ActualizarCapituloInput,
    token: string,
  ): Promise<{ message: string; capitulo: Capitulo }> =>
    apiFetch<{ message: string; capitulo: Capitulo }>(`/catalog/chapters/${capituloId}`, {
      method: 'PATCH',
      body: input,
      token,
    }),

  eliminarCapitulo: (capituloId: string, token: string): Promise<{ message: string; claseId: string }> =>
    apiFetch<{ message: string; claseId: string }>(`/catalog/chapters/${capituloId}`, {
      method: 'DELETE',
      token,
    }),
};
