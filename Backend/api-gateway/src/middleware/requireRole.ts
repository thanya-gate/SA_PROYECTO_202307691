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
    const normalizedRequired = requiredRole.startsWith('ROLE_')
      ? requiredRole
      : `ROLE_${requiredRole}`;
    const roles = (req.context?.roles ?? []).map((role) => {
      if (role.startsWith('ROLE_')) return role;
      return roleNames[`ROLE_${role}`] ? `ROLE_${role}` : role;
    });
    if (!roles.includes(normalizedRequired)) {
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
