import { apiFetch } from './http';

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
}

export interface SemestreResumen {
  semestre: string;
  anio: number;
  escuela: string;
  totalClases: number;
}

export interface SearchParams {
  semestre?: string;
  escuela?: string;
  curso?: string;
  catedratico?: string;
  tema?: string;
}

interface SearchResponse {
  resultados: ClaseResumen[];
}

interface GetClaseResponse {
  clase: ClaseDetalle;
}

interface SemestresResponse {
  semestres: SemestreResumen[];
}

function toQuery(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value.trim().length > 0) {
      query.set(key, value.trim());
    }
  }
  const raw = query.toString();
  return raw.length > 0 ? `?${raw}` : '';
}

export const catalogApi = {
  search: (params: SearchParams, token: string): Promise<SearchResponse> =>
    apiFetch<SearchResponse>(`/catalog/classes${toQuery(params)}`, { token }),

  getClase: (claseId: string, token: string): Promise<GetClaseResponse> =>
    apiFetch<GetClaseResponse>(`/catalog/classes/${claseId}`, { token }),

  semestres: (semestre: string, token: string): Promise<SemestresResponse> =>
    apiFetch<SemestresResponse>(`/catalog/semestres${semestre ? `?semestre=${encodeURIComponent(semestre)}` : ''}`, {
      token,
    }),
};
