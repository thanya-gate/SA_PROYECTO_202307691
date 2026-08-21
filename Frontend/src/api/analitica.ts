import { apiFetch } from './http';

export interface RankingItem {
  claseId: string;
  totalVistas: number;
  promedioCalificacion: number;
  totalCalificaciones: number;
  posicion: number;
}

export interface RecomendacionItem {
  claseId: string;
  porcentajeRecomendacion: number;
  totalVistas: number;
  promedioCalificacion: number;
  fechaCalculo: string;
}

interface ClasesMasVistasResponse {
  semana: string;
  items: RankingItem[];
}

interface ListaConSemanaResponse {
  semana: string;
  items: RankingItem[];
}

interface ListaResponse {
  items: RankingItem[];
}

interface RecomendacionesResponse {
  items: RecomendacionItem[];
}

export const analiticaApi = {
  clasesMasVistas: (semana: string, limite: number, token: string): Promise<ClasesMasVistasResponse> =>
    apiFetch<ClasesMasVistasResponse>(
      `/analitica/clases-mas-vistas?limite=${limite}${semana ? `&semana=${encodeURIComponent(semana)}` : ''}`,
      { token },
    ),

  tendenciasExamenes: (limite: number, token: string, desde?: string, hasta?: string): Promise<ListaConSemanaResponse> =>
    apiFetch<ListaConSemanaResponse>(
      `/analitica/tendencias-examenes?limite=${limite}${desde ? `&desde=${encodeURIComponent(desde)}` : ''}${hasta ? `&hasta=${encodeURIComponent(hasta)}` : ''}`,
      { token },
    ),

  rankingMejorValoradas: (limite: number, token: string): Promise<ListaResponse> =>
    apiFetch<ListaResponse>(`/analitica/ranking-mejor-valoradas?limite=${limite}`, { token }),

  recomendaciones: (limite: number, token: string): Promise<RecomendacionesResponse> =>
    apiFetch<RecomendacionesResponse>(`/analitica/recomendaciones/me?limite=${limite}`, { token }),
};
