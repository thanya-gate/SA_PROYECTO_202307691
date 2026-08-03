import { Response } from 'express';
import { config } from '../config/env';

const cookieBase = {
  httpOnly: true,
  sameSite: config.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none',
  secure: config.COOKIE_SECURE,
  path: config.COOKIE_PATH,
};

export function setSessionCookie(res: Response, token: string, maxAgeMs: number): void {
  res.cookie(config.SESSION_COOKIE_NAME, token, { ...cookieBase, maxAge: maxAgeMs });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(config.SESSION_COOKIE_NAME, { ...cookieBase });
}
