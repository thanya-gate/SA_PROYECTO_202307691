import { SessionStatus } from '../enums/auth';

/**
 * Entidad Sesión.
 * Refleja la tabla `sesion` del DER. En producción vive en una BD y,
 * para validación rápida del API Gateway, se proyecta en vw_sesiones_activas.
 */
export interface Session {
  sessionId: string;
  userId: string;
  status: SessionStatus;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  ip?: string;
  userAgent?: string;
}
