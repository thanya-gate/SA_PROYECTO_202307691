import { Router } from 'express';
import { container } from '../../../container';
import { config } from '../../../config/env';
import { loginSchema, registerSchema } from '../../../application/dto/auth-schemas';
import { setSessionCookie, clearSessionCookie } from '../utils/cookies';
import { loginRateLimiter, recordLoginAttempt } from '../middleware/rate-limiter';
import { createAuthenticate } from '../middleware/authenticate';

const router = Router();
const auth = container.authService;
const authenticate = createAuthenticate(container);

const sessionCookieMaxAge = config.SESSION_TTL_MS;

/** CDU0001.4 - Registro de cuenta nueva (solo correo institucional). */
router.post('/register', async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await auth.register(input, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    setSessionCookie(res, result.accessToken, sessionCookieMaxAge);
    res.status(201).json({
      message: 'Cuenta creada. Revisa tu correo para confirmar el registro.',
      user: publicUser(result.user),
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

/** CDU0001.1 - Login con correo institucional + contraseña. */
router.post('/login', loginRateLimiter, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await auth.login(input, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    recordLoginAttempt(req, res, true);
    setSessionCookie(res, result.accessToken, sessionCookieMaxAge);
    res.json({
      message: 'Sesión iniciada',
      user: publicUser(result.user),
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    recordLoginAttempt(req, res, false);
    next(err);
  }
});

/** Cierre de sesión (revoca la sesión actual y limpia la cookie). */
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await auth.logout(req.auth!.sessionId);
    clearSessionCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/** Información de la sesión actual. */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await auth.validateSession(req.auth!.sessionId);
    if (!user) return res.status(401).json({ error: { code: 'SESION_INVALIDA' } });
    return res.json({ user: publicUser(user), sessionId: req.auth!.sessionId });
  } catch (err) {
    return next(err);
  }
});

function publicUser(u: { userId: string; email: string; emailVerified: boolean; roles: string[] }) {
  return {
    userId: u.userId,
    email: u.email,
    emailVerified: u.emailVerified,
    roles: u.roles,
  };
}

export default router;
