import { NextFunction, Request, Response } from 'express';
import { config } from '../config/env';
import { DomainError } from '../domain/domain-error';


export function domainGuard(req: Request, _res: Response, next: NextFunction): void {
  const email = (req.body?.email ?? '').trim().toLowerCase();
  const domain = email.split('@')[1] ?? '';
  if (!config.ALLOWED_EMAIL_DOMAINS.includes(domain)) {
    return next(
      new DomainError(
        'DOMINIO_NO_AUTORIZADO',
        'Solo se permiten correos del dominio institucional de la Facultad de Ingeniería',
        403,
      ),
    );
  }
  next();
}
