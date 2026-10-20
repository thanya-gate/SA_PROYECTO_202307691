import { NextFunction, Request, Response } from 'express';
import * as grpc from '@grpc/grpc-js';
import { config } from '../config/env';
import { GrpcError } from '../grpc/auth-client';
import { isDomainError } from '../domain/domain-error';

const grpcToHttp: Record<number, number> = {
  [grpc.status.OK]: 200,
  [grpc.status.INVALID_ARGUMENT]: 400,
  [grpc.status.UNAUTHENTICATED]: 401,
  [grpc.status.PERMISSION_DENIED]: 403,
  [grpc.status.NOT_FOUND]: 404,
  [grpc.status.ALREADY_EXISTS]: 409,
  [grpc.status.FAILED_PRECONDITION]: 409,
  [grpc.status.UNIMPLEMENTED]: 501,
  [grpc.status.UNAVAILABLE]: 503,
};

/**
 * Auditoria de seguridad: registra intentos de acceso no autorizado
 * (login fallido, token invalido, sesion revocada, permiso denegado) para que
 * Logstash los etiquete y Kibana los visualice en el dashboard.
 */
function logAuthFailure(
  req: Request,
  code: string,
  httpStatus: number,
  message: string,
): void {
  if (httpStatus !== 401 && httpStatus !== 403) return;
  // eslint-disable-next-line no-console
  console.error(
    `[api-gateway] LOGIN_FALLIDO code=${code} ruta=${req.method} ${req.originalUrl} ip=${req.ip} detalle="${message}"`,
  );
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isDomainError(err)) {
    logAuthFailure(req, err.code, err.httpStatus, err.message);
    res.status(err.httpStatus).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof GrpcError) {
    const status = grpcToHttp[err.grpcCode] ?? 500;
    logAuthFailure(req, grpcCodeToDomain(err.grpcCode), status, err.message);
    res.status(status).json({
      error: {
        code: grpcCodeToDomain(err.grpcCode),
        message: err.message,
      },
    });
    return;
  }

  console.error('[api-gateway] error no controlado:', err);
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

function grpcCodeToDomain(code: number): string {
  switch (code) {
    case grpc.status.INVALID_ARGUMENT:
      return 'ENTRADA_INVALIDA';
    case grpc.status.UNAUTHENTICATED:
      return 'SESION_INVALIDA';
    case grpc.status.PERMISSION_DENIED:
      return 'PERMISO_DENEGADO';
    case grpc.status.NOT_FOUND:
      return 'NO_ENCONTRADO';
    case grpc.status.ALREADY_EXISTS:
    case grpc.status.FAILED_PRECONDITION:
      return 'CONFLICTO';
    case grpc.status.UNAVAILABLE:
      return 'SERVICIO_NO_DISPONIBLE';
    default:
      return 'ERROR_INTERNO';
  }
}
