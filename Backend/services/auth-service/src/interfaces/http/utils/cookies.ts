import { Response } from 'express';
import { config, isProduction } from '../../../config/env';

/**
 * Emite la Session Cookie (RF-03).
 * HttpOnly=true: inaccesible desde JavaScript del cliente (anti-XSS).
 * Secure=true: solo se envía por HTTPS (RNF-04). En local se fuerza a false
 * para permitir pruebas sobre http://localhost.
 * SameSite=lax evita el envío cross-site (anti-CSRF básico).
 */
export function setSessionCookie(res: Response, token: string, maxAgeMs: number): void {
  res.cookie(config.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction || config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
    path: config.COOKIE_PATH,
    maxAge: maxAgeMs,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(config.SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction || config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAME_SITE,
    path: config.COOKIE_PATH,
  });
}
