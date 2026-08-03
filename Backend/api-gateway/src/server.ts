import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import { authGrpc } from './grpc/auth-client';
import { DomainError } from './domain/domain-error';
import { setSessionCookie, clearSessionCookie } from './utils/cookies';
import { authenticate } from './middleware/authenticate';
import { requireRole } from './middleware/requireRole';
import { domainGuard } from './middleware/domain-guard';
import { errorHandler } from './middleware/error-handler';

const cookieMaxAge = config.SESSION_TTL_MS;

function publicUser(u: { userId: string; email: string; emailVerified: boolean; roles: string[] }) {
  return { userId: u.userId, email: u.email, emailVerified: u.emailVerified, roles: u.roles };
}

function toProtoRole(role: string): string {
  const normalized = role.trim().toUpperCase();
  return normalized.startsWith('ROLE_') ? normalized : `ROLE_${normalized}`;
}

export function createGateway(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/health', async (_req, res) => {
    let authStatus = 'unknown';
    try {
      const health = await authGrpc.health();
      authStatus = health.status;
    } catch {
      authStatus = 'unavailable';
    }
    res.json({ status: 'ok', service: 'api-gateway', version: '1.0.0', authService: authStatus });
  });

  // ===== Autenticación =====
  app.post('/auth/register', domainGuard, async (req, res, next) => {
    try {
      const { email, password, confirmPassword } = req.body as Record<string, unknown>;
      if (typeof password !== 'string' || password.length < 8 || password !== confirmPassword) {
        throw new DomainError('ENTRADA_INVALIDA', 'Contraseña inválida o no coincide', 400);
      }
      const result = await authGrpc.register({
        email: String(email),
        password,
        confirmPassword: String(confirmPassword),
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      setSessionCookie(res, result.accessToken, cookieMaxAge);
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

  app.post('/auth/login', domainGuard, async (req, res, next) => {
    try {
      const { email, password } = req.body as Record<string, unknown>;
      if (typeof password !== 'string' || password.length === 0) {
        throw new DomainError('ENTRADA_INVALIDA', 'Contraseña requerida', 400);
      }
      const result = await authGrpc.login({
        email: String(email),
        password,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      setSessionCookie(res, result.accessToken, cookieMaxAge);
      res.json({
        message: 'Sesión iniciada',
        user: publicUser(result.user),
        accessToken: result.accessToken,
        expiresAt: result.expiresAt,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/logout', authenticate, async (req, res, next) => {
    try {
      await authGrpc.logout(req.context!.sessionId);
      clearSessionCookie(res);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  app.get('/auth/me', authenticate, async (req, res, next) => {
    try {
      const result = await authGrpc.getCurrentUser(req.context!.sessionId);
      res.json({ user: publicUser(result.user), sessionId: result.sessionId });
    } catch (err) {
      next(err);
    }
  });

  // ===== Perfiles / RBAC =====
  app.get('/profiles/me', authenticate, async (req, res, next) => {
    try {
      const view = await authGrpc.getProfiles(req.context!.userId);
      res.json(view);
    } catch (err) {
      next(err);
    }
  });

  app.patch('/profiles/:userId/roles', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const role = toProtoRole(String((req.body as Record<string, unknown>).role ?? ''));
      if (role === 'ROLE_') {
        throw new DomainError('ENTRADA_INVALIDA', 'Rol requerido', 400);
      }
      const view = await authGrpc.assignRole(req.params.userId, role);
      res.json(view.profiles);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/profiles/:userId/roles/:role', authenticate, requireRole('ROLE_ADMIN'), async (req, res, next) => {
    try {
      const role = toProtoRole(req.params.role);
      const view = await authGrpc.removeRole(req.params.userId, role);
      res.json(view.profiles);
    } catch (err) {
      next(err);
    }
  });

  app.post('/profiles/switch', authenticate, async (req, res, next) => {
    try {
      const role = toProtoRole(String((req.body as Record<string, unknown>).role ?? ''));
      if (role === 'ROLE_') {
        throw new DomainError('ENTRADA_INVALIDA', 'Rol requerido', 400);
      }
      await authGrpc.switchProfile(req.context!.userId, role, req.context!.sessionId);
      res.json({
        message: 'Perfil cambiado. Inicia sesión de nuevo para obtener el nuevo token.',
        pendingRole: role,
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/profiles/permission', authenticate, async (req, res, next) => {
    try {
      const { resource, action } = req.body as Record<string, unknown>;
      if (typeof resource !== 'string' || typeof action !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'resource y action requeridos', 400);
      }
      const allowed = await authGrpc.checkPermission(req.context!.userId, resource, action);
      res.json({ allowed });
    } catch (err) {
      next(err);
    }
  });

  app.post('/account/verify-email', authenticate, async (req, res, next) => {
    try {
      const { token } = await authGrpc.requestEmailVerification(req.context!.email);
      res.json({ message: 'Token de verificación generado', token });
    } catch (err) {
      next(err);
    }
  });

  app.post('/account/verify-email/confirm', async (req, res, next) => {
    try {
      const { token } = req.body as Record<string, unknown>;
      if (typeof token !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'Token requerido', 400);
      }
      await authGrpc.confirmEmailVerification(token);
      res.json({ message: 'Correo verificado correctamente' });
    } catch (err) {
      next(err);
    }
  });

  app.post('/account/reset-password', async (req, res, next) => {
    try {
      const { email } = req.body as Record<string, unknown>;
      if (typeof email !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'Correo requerido', 400);
      }
      const { token } = await authGrpc.requestPasswordReset(email);
      res.json({ message: 'Si el correo existe, recibirás un enlace para restablecer', token });
    } catch (err) {
      next(err);
    }
  });

  app.post('/account/reset-password/confirm', async (req, res, next) => {
    try {
      const { token, newPassword } = req.body as Record<string, unknown>;
      if (typeof token !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
        throw new DomainError('ENTRADA_INVALIDA', 'Token y nueva contraseña requeridos', 400);
      }
      await authGrpc.confirmPasswordReset(token, newPassword);
      res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
      next(err);
    }
  });

  app.post('/account/change-password', authenticate, async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body as Record<string, unknown>;
      if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
        throw new DomainError('ENTRADA_INVALIDA', 'Contraseñas inválidas', 400);
      }
      await authGrpc.changePassword(req.context!.userId, currentPassword, newPassword);
      res.json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/oauth/authorize', domainGuard, async (req, res, next) => {
    try {
      const { email, roles } = req.body as { email?: string; roles?: string[] };
      if (!email) {
        throw new DomainError('ENTRADA_INVALIDA', 'Correo requerido', 400);
      }
      const protoRoles = (roles ?? []).map(toProtoRole);
      const result = await authGrpc.oauthAuthorize(email, protoRoles);
      res.json({ redirect_uri: result.redirectUri, code: result.code });
    } catch (err) {
      next(err);
    }
  });

  app.post('/auth/oauth/callback', async (req, res, next) => {
    try {
      const { code } = req.body as Record<string, unknown>;
      if (typeof code !== 'string') {
        throw new DomainError('ENTRADA_INVALIDA', 'Código OAuth requerido', 400);
      }
      const result = await authGrpc.oauthCallback(code, req.ip, req.headers['user-agent']);
      setSessionCookie(res, result.accessToken, cookieMaxAge);
      res.json({
        message: 'Sesión iniciada con identidad institucional',
        user: publicUser(result.user),
        accessToken: result.accessToken,
        expiresAt: result.expiresAt,
        provider: result.provider,
      });
    } catch (err) {
      next(err);
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'RUTA_NO_ENCONTRADA', message: `${req.method} ${req.path}` } });
  });

  app.use(errorHandler);

  return app;
}

export function listenGateway(app: Express): ReturnType<typeof app.listen> {
  return app.listen(config.PORT, () => {
    console.log(`[api-gateway] HTTP escuchando en http://localhost:${config.PORT}`);
    console.log(`[api-gateway] gRPC -> auth-service en ${config.AUTH_GRPC_ADDR}`);
  });
}
