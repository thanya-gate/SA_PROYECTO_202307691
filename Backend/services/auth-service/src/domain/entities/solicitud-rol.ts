import { Role } from '../enums/role';

/**
 * Estados de una solicitud de rol (tabla `solicitud_rol` del DER del Auth Service).
 */
export type SolicitudEstado = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA';

export const SOLICITUD_ESTADOS: SolicitudEstado[] = ['PENDIENTE', 'ACEPTADA', 'RECHAZADA'];

/**
 * Entidad Solicitud de Rol.
 * Un usuario solicita obtener el rol de catedrático o auxiliar; el administrador
 * la aprueba (otorga el rol) o la rechaza.
 */
export interface SolicitudRol {
  solicitudId: string;
  usuarioId: string;
  correo: string;
  nombres: string | null;
  apellidos: string | null;
  carnet: string | null;
  rolSolicitado: Role;
  estado: SolicitudEstado;
  fechaSolicitud: Date;
  fechaResolucion: Date | null;
  resueltoPor: string | null;
}
