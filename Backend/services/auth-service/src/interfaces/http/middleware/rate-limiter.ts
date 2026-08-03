import { NextFunction, Request, Response } from 'express';
import { config } from '../../../config/env';
import { DomainError } from '../../../domain/errors/domain-error';

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

const attempts = new Map<string, AttemptRecord>();

/**
 * Limitador simple de intentos de login en memoria.
 * Replica el contador de intentos fallidos del FE-02 (CDU0001.1) y el
 * bloqueo temporal. En producción usar Redis para compartir entre réplicas.
 */
export function loginRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const key = `${req.ip ?? 'unknown'}:${String(req.body?.email ?? '').toLowerCase()}`;

  const record = attempts.get(key);
  const windowMs = config.LOGIN_ATTEMPTS_WINDOW_MIN * 60 * 1000;

  if (record?.blockedUntil && record.blockedUntil > Date.now()) {
    const remaining = Math.ceil((record.blockedUntil - Date.now()) / 1000);
    res.setHeader('Retry-After', String(remaining));
    next(
      new DomainError(
        'CUENTA_BLOQUEADA',
        `Demasiados intentos. Intenta de nuevo en ${remaining} segundos`,
        429,
      ),
    );
    return;
  }

  res.locals.loginRateKey = key;

  // Reinicia el contador si venció la ventana.
  if (record && Date.now() - record.firstAttemptAt > windowMs) {
    attempts.set(key, { count: 0, firstAttemptAt: Date.now() });
  }

  next();
}

export function recordLoginAttempt(_req: Request, res: Response, success: boolean): void {
  const key = res.locals.loginRateKey as string | undefined;
  if (!key) return;

  if (success) {
    attempts.delete(key);
    return;
  }

  const now = Date.now();
  const windowMs = config.LOGIN_ATTEMPTS_WINDOW_MIN * 60 * 1000;
  const current = attempts.get(key) ?? { count: 0, firstAttemptAt: now };
  const nextCount = current.count + 1;

  if (nextCount >= config.MAX_LOGIN_ATTEMPTS) {
    attempts.set(key, {
      count: nextCount,
      firstAttemptAt: current.firstAttemptAt,
      blockedUntil: now + windowMs,
    });
    return;
  }
  attempts.set(key, { count: nextCount, firstAttemptAt: current.firstAttemptAt });
}
