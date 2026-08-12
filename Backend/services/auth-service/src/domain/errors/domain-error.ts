/**
 * Error de dominio. Se traduce a HTTP (400/401/403/404/409) y gRPC
 * (INVALID_ARGUMENT / UNAUTHENTICATED / PERMISSION_DENIED / NOT_FOUND / ALREADY_EXISTS).
 */
export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly httpStatus: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export type DomainErrorCode =
  | 'DOMINIO_NO_AUTORIZADO'
  | 'CORREO_YA_REGISTRADO'
  | 'CARNET_YA_REGISTRADO'
  | 'DPI_YA_REGISTRADO'
  | 'CREDENCIALES_INVALIDAS'
  | 'CUENTA_BLOQUEADA'
  | 'SESION_INVALIDA'
  | 'SESION_EXPIRADA'
  | 'SESION_REVOCADA'
  | 'TOKEN_INVALIDO'
  | 'TOKEN_EXPIRADO'
  | 'USUARIO_NO_ENCONTRADO'
  | 'PERMISO_DENEGADO'
  | 'ROL_INVALIDO'
  | 'ROL_YA_ASIGNADO'
  | 'SOLICITUD_NO_ENCONTRADA'
  | 'SOLICITUD_RESUELTA'
  | 'SOLICITUD_DUPLICADA'
  | 'ENTRADA_INVALIDA'
  | 'CONFLICTO_ALMACENAMIENTO'
  | 'ERROR_INTERNO';

export const isDomainError = (err: unknown): err is DomainError =>
  err instanceof DomainError;
