import { apiFetch } from './http';

export interface Checkpoint {
  historialId: string;
  claseId: string;
  segundoActual: number;
  duracion: number;
  porcentajeAvance: number;
  fechaActualizacion: string;
}

export interface HistorialItem {
  claseId: string;
  fechaUltimaVisualizacion: string;
  segundoActual: number;
  duracion: number;
  porcentajeAvance: number;
  tieneCheckpoint: boolean;
  codigo?: string;
  curso?: string;
  escuela?: string;
  unidad?: string;
  tema?: string;
  semestre?: string;
  anio?: number;
  urlVideo?: string;
}

interface GuardarCheckpointResponse {
  message: string;
  historialId: string;
  porcentajeAvance: number;
}

interface ObtenerCheckpointResponse {
  checkpoint: Checkpoint | null;
}

interface HistorialResponse {
  items: HistorialItem[];
}

interface RegistrarCalificacionResponse {
  message: string;
  registrada: boolean;
}

export const reproduccionApi = {
  guardarCheckpoint: (claseId: string, segundoActual: number, duracion: number, token: string, evento?: string): Promise<GuardarCheckpointResponse> =>
    apiFetch<GuardarCheckpointResponse>('/reproduccion/checkpoint', {
      method: 'POST',
      body: { claseId, segundoActual, duracion, ...(evento ? { evento } : {}) },
      token,
    }),

  obtenerCheckpoint: (claseId: string, token: string): Promise<ObtenerCheckpointResponse> =>
    apiFetch<ObtenerCheckpointResponse>(`/reproduccion/checkpoint/${encodeURIComponent(claseId)}`, { token }),

  historial: (token: string): Promise<HistorialResponse> =>
    apiFetch<HistorialResponse>('/reproduccion/historial', { token }),

  registrarCalificacion: (historialId: string, puntuacion: number, comentario: string, token: string, claseId?: string): Promise<RegistrarCalificacionResponse> =>
    apiFetch<RegistrarCalificacionResponse>('/reproduccion/calificaciones', {
      method: 'POST',
      body: { historialId, puntuacion, comentario, ...(claseId ? { claseId } : {}) },
      token,
    }),
};
