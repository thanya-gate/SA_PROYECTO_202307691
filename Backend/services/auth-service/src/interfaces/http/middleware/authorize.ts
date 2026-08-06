import { NextFunction, Response } from 'express';
import { DomainError } from '../../../domain/errors/domain-error';
import { Role, rolesPermiten } from '../../../domain/enums/role';
import { AuthenticatedRequest } from '../utils/request-context';

/**
 * Middleware de autorización RBAC (RF-06).
 * Uso: router.get('/x', requireRole('usuario', 'leer'), handler)
 */
export function requireRole(resource: string, action: string) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(new DomainError('SESION_INVALIDA', 'No autenticado', 401));
    }
    const allowed = rolesPermiten(req.auth.roles as Role[], resource, action);
    if (!allowed) {
      return next(
        new DomainError(
          'PERMISO_DENEGADO',
          'No tienes permisos para realizar esta acción',
          403,
        ),
      );
    }
    next();
  };
}
