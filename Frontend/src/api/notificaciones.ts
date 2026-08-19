import { apiFetch } from './http';

export interface NotificacionItem {
  id: string;
  tipo: string;
  asunto: string;
  cuerpo: string;
  estado: string;
  fechaCreacion: string;
  fechaEnvio: string;
}

export interface PlantillaItem {
  id: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  tipo: string;
}

export interface ColaItem {
  colaId: number;
  notificacionId: string;
  correoDestino: string;
  intentos: number;
  estado: string;
  ultimoError: string;
  fechaProximoIntento: string;
  contenido: string;
}

interface ListarNotificacionesResponse {
  items: NotificacionItem[];
}

interface EnviarAvisoResponse {
  message: string;
  destinatarioIds: string[];
  notificacionesEncoladas: number;
}

interface ListarPlantillasResponse {
  items: PlantillaItem[];
}

interface ConsultarColaResponse {
  items: ColaItem[];
}

export const notificacionesApi = {
  listarNotificaciones: (token: string): Promise<ListarNotificacionesResponse> =>
    apiFetch<ListarNotificacionesResponse>('/notificaciones/me', { token }),

  enviarAvisoGeneral: (
    token: string,
    mensaje: string,
    destinatarioIds?: string[],
  ): Promise<EnviarAvisoResponse> =>
    apiFetch<EnviarAvisoResponse>('/notificaciones/avisos', {
      method: 'POST',
      body: { mensaje, destinatarioIds: destinatarioIds ?? [] },
      token,
    }),

  listarPlantillas: (token: string): Promise<ListarPlantillasResponse> =>
    apiFetch<ListarPlantillasResponse>('/notificaciones/plantillas', { token }),

  consultarCola: (token: string): Promise<ConsultarColaResponse> =>
    apiFetch<ConsultarColaResponse>('/notificaciones/cola', { token }),
};
