import { Router } from 'express';
import { container } from '../../../container';
import { setSessionCookie } from '../utils/cookies';
import { config } from '../../../config/env';
import { DomainError } from '../../../domain/errors/domain-error';
import { loginRateLimiter } from '../middleware/rate-limiter';
import { MockOAuthProvider } from '../../../infrastructure/oauth/mock-oauth-provider';

const router = Router();
const auth = container.authService;

const sessionCookieMaxAge = config.SESSION_TTL_MS;

/**
 * Flujo OAuth 2.0 institucional (mock) - RF-04 / CDU0001.3.
 * /authorize  -> el "usuario" se autentica en el proveedor (devuelve un code)
 * /callback   -> el sistema intercambia el code por el perfil federado
 *
 * NOTA: Estas rutas HTTP solo se usan cuando OAUTH_PROVIDER=mock.
 * Cuando OAUTH_PROVIDER=google, el flujo es manejado por el API Gateway
 * y el intercambio de código pasa por el gRPC OAuthCallback.
 */
router.post('/authorize', loginRateLimiter, async (req, res, next) => {
  try {
    const { email, roles } = req.body as { email?: string; roles?: string[] };
    if (!email) {
      throw new DomainError('ENTRADA_INVALIDA', 'email requerido', 400);
    }
    const mockProvider = container.oauthProvider as MockOAuthProvider;
    const code = mockProvider.authorize(email, roles);
    res.json({
      // Simula la URL de redirect del proveedor al sistema.
      redirect_uri: `${config.OAUTH_REDIRECT_URI}?code=${code}`,
      code,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/callback', loginRateLimiter, async (req, res, next) => {
  try {
    const { code } = req.body as { code?: string };
    if (!code) {
      throw new DomainError('ENTRADA_INVALIDA', 'code requerido', 400);
    }
    const mockProvider = container.oauthProvider as MockOAuthProvider;
    const profile = mockProvider.exchange(code);
    const result = await auth.loginWithOAuth(profile, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (result.newUser) {
      void container.notificacionesClient.notificarConfirmacionRegistro(result.user);
    }

    setSessionCookie(res, result.accessToken, sessionCookieMaxAge);
    res.json({
      message: 'Sesión iniciada con identidad institucional',
      user: {
        userId: result.user.userId,
        email: result.user.email,
        emailVerified: result.user.emailVerified,
        roles: result.user.roles,
      },
      accessToken: result.accessToken,
      expiresAt: result.expiresAt,
      provider: 'institucional',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
