export interface NotificacionRegistrada {
  notificacionId: string;
}

export interface NotificacionItem {
  id: string;
  tipo: string;
  asunto: string;
  cuerpo: string;
  estado: string;
  fechaCreacion: string;
  fechaEnvio: string | null;
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
  ultimoError: string | null;
  fechaProximoIntento: string | null;
  contenido: string;
}

export interface PendienteEnvio {
  notificacionId: string;
  correoDestino: string;
  tipo: string;
  datosContexto: Record<string, unknown>;
  colaId: number;
  intentos: number;
  contenido: string;
}
