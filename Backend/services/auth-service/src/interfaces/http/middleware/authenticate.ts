import { NextFunction, Response } from 'express';
import { config } from '../../../config/env';
import { DomainError } from '../../../domain/errors/domain-error';
import { Container } from '../../../container';
import {
  AuthContext,
  AuthenticatedRequest,
  extractBearerToken,
} from '../utils/request-context';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

/**
 * Middleware de autenticación (RF-03).
 * Valida el JWT (firma, issuer, audience, expiración) y confirma que la
 * sesión referenciada en el claim `sid` siga activa en el repositorio.
 * El token llega preferentemente por Session Cookie (HttpOnly/Secure) y,
 * como alternativa, por header Authorization: Bearer (para servicios/gRPC).
 */
export function createAuthenticate(c: Container) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      const cookieToken = (req.cookies as Record<string, string> | undefined)?.[
        config.SESSION_COOKIE_NAME
      ];
      const token = cookieToken ?? extractBearerToken(req);

      if (!token) {
        throw new DomainError('SESION_INVALIDA', 'No se proporcionó una sesión', 401);
      }

      const payload = await c.tokenService.verifyAccessToken(token);

      // La sesión referenciada debe seguir ACTIVA en el repo (revocación inmediata).
      const session = await c.sessionService.validate(payload.sessionId);
      if (!session) {
        throw new DomainError('SESION_REVOCADA', 'La sesión ya no está activa', 401);
      }

      req.auth = {
        userId: payload.sub,
        email: payload.email,
        roles: payload.roles,
        sessionId: payload.sessionId,
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}
