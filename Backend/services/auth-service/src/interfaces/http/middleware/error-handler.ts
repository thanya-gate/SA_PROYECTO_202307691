import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { isDomainError } from '../../../domain/errors/domain-error';
import { config } from '../../../config/env';

/** Mapa de errores de dominio a códigos gRPC (para consistencia entre HTTP y gRPC). */
export const domainErrorToGrpcCode: Record<string, number> = {
  DOMINIO_NO_AUTORIZADO: 7, // PERMISSION_DENIED
  CORREO_YA_REGISTRADO: 6, // ALREADY_EXISTS
  CREDENCIALES_INVALIDAS: 16, // UNAUTHENTICATED
  CUENTA_BLOQUEADA: 16, // UNAUTHENTICATED
  SESION_INVALIDA: 16, // UNAUTHENTICATED
  SESION_EXPIRADA: 16, // UNAUTHENTICATED
  SESION_REVOCADA: 16, // UNAUTHENTICATED
  TOKEN_INVALIDO: 3, // INVALID_ARGUMENT
  TOKEN_EXPIRADO: 3, // INVALID_ARGUMENT
  USUARIO_NO_ENCONTRADO: 5, // NOT_FOUND
  PERMISO_DENEGADO: 7, // PERMISSION_DENIED
  ROL_INVALIDO: 3, // INVALID_ARGUMENT
  ENTRADA_INVALIDA: 3, // INVALID_ARGUMENT
  CONFLICTO_ALMACENAMIENTO: 9, // FAILED_PRECONDITION
};

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isDomainError(err)) {
    res.status(err.httpStatus).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: _req.id,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'ENTRADA_INVALIDA',
        message: 'Datos de entrada inválidos',
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  // eslint-disable-next-line no-console
  console.error('[auth-service] error no controlado:', err);
  res.status(500).json({
    error: {
      code: 'ERROR_INTERNO',
      message:
        config.NODE_ENV === 'production'
          ? 'Error interno del servidor'
          : String(err instanceof Error ? err.message : err),
    },
  });
}
