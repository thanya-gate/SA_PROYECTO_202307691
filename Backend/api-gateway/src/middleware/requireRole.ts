import { NextFunction, Request, Response } from 'express';
import { DomainError } from '../domain/domain-error';

const roleNames: Record<string, string> = {
  ROLE_ESTUDIANTE: 'ESTUDIANTE',
  ROLE_CATEDRATICO: 'CATEDRATICO',
  ROLE_AUXILIAR: 'AUXILIAR',
  ROLE_ADMIN: 'ADMIN',
};

export function requireRole(requiredRole: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const roles = req.context?.roles ?? [];
    if (!roles.includes(requiredRole) && !roles.map((r) => roleNames[r]).includes(requiredRole)) {
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


export function requireAnyRole(...requiredRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const roles = (req.context?.roles ?? []).map((r) => (r.startsWith('ROLE_') ? r : `ROLE_${r}`));
    if (!requiredRoles.some((role) => roles.includes(role))) {
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
