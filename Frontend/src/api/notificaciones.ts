import { apiFetch } from './http';

export interface Notificacion {
  id: string;
  tipo: string;
  asunto: string;
  cuerpo: string;
  estado: string;
  fecha_creacion: string;
  fecha_envio: string | null;
}

export interface Plantilla {
  id: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  tipo: string;
}

export interface ColaItem {
  cola_id: number;
  notificacion_id: string;
  correo_destino: string;
  intentos: number;
  estado: string;
  ultimo_error: string | null;
  fecha_proximo_intento: string;
  contenido: string;
}

export async function listarNotificaciones(token: string | null, limite = 50): Promise<Notificacion[]> {
  return apiFetch<Notificacion[]>(`/notificaciones/me?limite=${limite}`, { token });
}

export async function listarPlantillas(token: string | null): Promise<Plantilla[]> {
  return apiFetch<Plantilla[]>('/notificaciones/plantillas', { token });
}

export async function consultarCola(token: string | null, limite = 100): Promise<ColaItem[]> {
  return apiFetch<ColaItem[]>(`/notificaciones/cola?limite=${limite}`, { token });
}

export async function enviarAvisoGeneral(
  token: string | null,
  mensaje: string,
  destinatarioIds?: string[],
): Promise<{ notificacionesEncoladas: number }> {
  return apiFetch<{ notificacionesEncoladas: number }>('/notificaciones/avisos', {
    method: 'POST',
    token,
    body: { mensaje, destinatarioIds },
  });
}
