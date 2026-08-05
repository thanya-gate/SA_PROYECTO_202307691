import express, { Router, Request, Response, NextFunction } from 'express';
import { config } from './config/env';
import { authGrpc } from './grpc/auth-client';
import { DomainError } from './domain/domain-error';

/**
 * Proveedor de identidad institucional SIMULADO (IdP mock).
 *
 * Implementa la parte del IdP del flujo OAuth 2.0 Authorization Code para
 * mostrar el mismo comportamiento de un flujo real:
 *
 *   1. El SPA obtiene la URL de autorización (login_uri) del IdP.
 *   2. El navegador se redirige a GET /mock-oauth/login (la pantalla del IdP).
 *   3. El usuario se autentica con su correo institucional (la contraseña no se
 *      valida: es un entorno de demostración; el IdP real validaría las credenciales
 *      contra su propio directorio).
 *   4. El IdP genera un authorization code (único, 5 min) y redirige al cliente
 *      (redirect_uri) con ?code=...&state=...
 *   5. El SPA intercambia el código en POST /auth/oauth/callback.
 *
 * En producción este componente viviría en un dominio separado (p. ej.
 * login.ingenieria.usac.edu.gt) y validaría credenciales reales; aquí se aloja
 * en el gateway para no añadir infraestructura y porque es el punto de entrada
 * único del sistema.
 */

const ALLOWED_RESPONSE_TYPES = new Set(['code']);

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeRoles(roles: string | undefined): string[] {
  return (roles ?? '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const up = r.toUpperCase();
      return up.startsWith('ROLE_') ? up : `ROLE_${up}`;
    });
}

/** Construye la URL de autorización del IdP (paso 1 del flujo). */
export function buildIdpLoginUri(opts: { email: string; state?: string; roles?: string[] }): string {
  const params = new URLSearchParams({
    client_id: config.OAUTH_CLIENT_ID,
    redirect_uri: config.OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    email: opts.email,
  });
  if (opts.state) params.set('state', opts.state);
  if (opts.roles && opts.roles.length > 0) params.set('roles', opts.roles.join(','));
  return `${config.OAUTH_ISSUER_PUBLIC}/login?${params.toString()}`;
}

function renderLoginPage(opts: {
  email?: string;
  clientId?: string;
  redirectUri?: string;
  responseType?: string;
  state?: string;
  roles?: string;
  error?: string;
}): string {
  const { email = '', clientId = '', redirectUri = '', responseType = 'code', state = '', roles = '', error } = opts;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Iniciar sesión · Identidad YoUSAC</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(160deg, #0b3d91 0%, #082e6e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .idp-card {
      background: #ffffff;
      border-radius: 12px;
      width: 100%;
      max-width: 380px;
      padding: 2.2rem 2rem;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.25);
    }
    .idp-brand { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.25rem; }
    .idp-heart { color: #d9251c; font-size: 1.6rem; line-height: 1; }
    .idp-brand strong { color: #0b3d91; font-size: 1.1rem; letter-spacing: 0.02em; }
    .idp-subtitle { color: #6b7280; font-size: 0.8rem; margin-bottom: 1.4rem; }
    .idp-title { font-size: 1.05rem; color: #111827; margin-bottom: 1.2rem; }
    .idp-field { margin-bottom: 1rem; }
    .idp-field label { display: block; font-size: 0.78rem; font-weight: 600; color: #374151; margin-bottom: 0.3rem; }
    .idp-field input {
      width: 100%; padding: 0.65rem 0.75rem; border: 1px solid #d1d5db; border-radius: 8px;
      font-size: 0.95rem;
    }
    .idp-field input:focus { outline: 2px solid #0b3d91; border-color: transparent; }
    .idp-error {
      background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 8px;
      padding: 0.6rem 0.75rem; font-size: 0.82rem; margin-bottom: 1rem;
    }
    .idp-note { font-size: 0.72rem; color: #6b7280; margin: 1rem 0 0; line-height: 1.5; }
    .idp-submit {
      width: 100%; margin-top: 0.25rem; padding: 0.7rem; border: 0; border-radius: 8px;
      background: #0b3d91; color: #ffffff; font-size: 0.95rem; font-weight: 600; cursor: pointer;
    }
    .idp-submit:hover { background: #082e6e; }
  </style>
</head>
<body>
  <form class="idp-card" method="post" action="/mock-oauth/login">
    <div class="idp-brand"><span class="idp-heart">♥</span><strong>YoUSAC</strong></div>
    <p class="idp-subtitle">Servicio de Identidad Institucional · Facultad de Ingeniería</p>
    <h1 class="idp-title">Iniciar sesión</h1>

    ${error ? `<div class="idp-error">${esc(error)}</div>` : ''}

    <input type="hidden" name="client_id" value="${esc(clientId)}" />
    <input type="hidden" name="redirect_uri" value="${esc(redirectUri)}" />
    <input type="hidden" name="response_type" value="${esc(responseType)}" />
    <input type="hidden" name="state" value="${esc(state)}" />
    <input type="hidden" name="roles" value="${esc(roles)}" />

    <div class="idp-field">
      <label for="idp-email">Correo institucional</label>
      <input id="idp-email" type="email" name="email" value="${esc(email)}" placeholder="persona@ingenieria.usac.edu.gt" required autofocus />
    </div>
    <div class="idp-field">
      <label for="idp-password">Contraseña</label>
      <input id="idp-password" type="password" name="password" placeholder="••••••••" required />
    </div>

    <button class="idp-submit" type="submit">Iniciar sesión</button>
    <p class="idp-note">Entorno de demostración: la contraseña no se valida. En producción esta pantalla pertenecería al dominio del proveedor institucional.</p>
  </form>
</body>
</html>`;
}

function idpErrorPage(message: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><title>Error · Identidad YoUSAC</title></head>
<body style="font-family:system-ui,sans-serif;background:#f3f4f6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
  <div style="background:#fff;border-radius:12px;padding:2rem;max-width:420px;box-shadow:0 10px 30px rgba(0,0,0,.15)">
    <h1 style="color:#0b3d91;font-size:1.1rem;margin:0 0 .75rem">No se pudo iniciar sesión</h1>
    <p style="color:#6b7280;font-size:.9rem;line-height:1.5;margin:0 0 1rem">${esc(message)}</p>
    <a href="/auth/oauth/authorize" style="color:#0b3d91;font-size:.85rem">Volver al inicio de sesión</a>
  </div>
</body>
</html>`;
}

export function createIdpRouter(): Router {
  const router = Router();

  // El IdP real no usa JSON; el formulario envía application/x-www-form-urlencoded.
  router.use(express.urlencoded({ extended: false }));

  // Pantalla de autenticación del proveedor (GET /mock-oauth/login).
  router.get('/login', (req: Request, res: Response): Response => {
    const { email, client_id, redirect_uri, response_type, state, roles } = req.query as Record<string, string | undefined>;

    if (client_id !== config.OAUTH_CLIENT_ID) {
      return res.status(400).send(idpErrorPage('Cliente no registrado (client_id inválido).'));
    }
    if (redirect_uri !== config.OAUTH_REDIRECT_URI) {
      return res.status(400).send(idpErrorPage('URI de redirección no autorizada.'));
    }
    if (response_type !== 'code') {
      return res.status(400).send(idpErrorPage('Tipo de respuesta no soportado.'));
    }

    return res.send(
      renderLoginPage({
        email,
        clientId: client_id,
        redirectUri: redirect_uri,
        responseType: response_type,
        state,
        roles,
      }),
    );
  });

  // Autenticación del usuario (POST /mock-oauth/login) -> redirige con el código.
  router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, client_id, redirect_uri, response_type, state, roles } = req.body as Record<
        string,
        string | undefined
      >;
      const normalizedEmail = (email ?? '').trim().toLowerCase();

      if (client_id !== config.OAUTH_CLIENT_ID) {
        throw new DomainError('ENTRADA_INVALIDA', 'Cliente no registrado (client_id inválido).', 400);
      }
      if (redirect_uri !== config.OAUTH_REDIRECT_URI) {
        throw new DomainError('ENTRADA_INVALIDA', 'URI de redirección no autorizada.', 400);
      }
      if (response_type !== undefined && !ALLOWED_RESPONSE_TYPES.has(response_type)) {
        throw new DomainError('ENTRADA_INVALIDA', 'Tipo de respuesta no soportado.', 400);
      }
      const domain = normalizedEmail.split('@')[1] ?? '';
      if (!config.ALLOWED_EMAIL_DOMAINS.includes(domain)) {
        throw new DomainError('DOMINIO_NO_AUTORIZADO', 'Correo no autorizado. Usa el dominio institucional de la Facultad de Ingeniería.', 403);
      }
      if (typeof password !== 'string' || password.length === 0) {
        throw new DomainError('ENTRADA_INVALIDA', 'La contraseña es requerida.', 400);
      }

      // En un IdP real aquí se validarían las credenciales contra el directorio
      // y los roles vendrían de los claims. En el mock, el auth-service genera el
      // authorization code (único, 5 min) y deja los roles en el perfil federado.
      const { code } = await authGrpc.oauthAuthorize(normalizedEmail, normalizeRoles(roles));

      const callback = new URL(redirect_uri);
      callback.searchParams.set('code', code);
      if (state) callback.searchParams.set('state', state);
      res.redirect(302, callback.toString());
    } catch (err) {
      next(err);
    }
  });

  return router;
}
