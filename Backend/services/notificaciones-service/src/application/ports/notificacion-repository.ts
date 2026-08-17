import {
  ColaItem,
  NotificacionItem,
  NotificacionRegistrada,
  PendienteEnvio,
  PlantillaItem,
} from '../../domain/entities/notificacion';

export interface RegistrarNotificacionInput {
  usuarioId: string;
  correoDestino: string;
  plantilla: string;
  tipo: string;
  datosContexto: Record<string, string>;
}

export interface NotificacionRepository {
  registrarNotificacion(input: RegistrarNotificacionInput): Promise<NotificacionRegistrada>;
  listarNotificaciones(usuarioId: string, limite: number): Promise<NotificacionItem[]>;
  listarPlantillas(): Promise<PlantillaItem[]>;
  consultarCola(limite: number): Promise<ColaItem[]>;
  obtenerPendientes(limite: number, maxIntentos: number): Promise<PendienteEnvio[]>;
  marcarEnviada(notificacionId: string): Promise<void>;
  registrarIntentoFallido(colaId: number, error: string): Promise<void>;
  marcarFallidaDefinitiva(colaId: number): Promise<void>;
}
