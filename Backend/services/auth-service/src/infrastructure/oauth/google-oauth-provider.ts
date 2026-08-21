import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { DomainError } from '../../domain/errors/domain-error';
import { OAuthProvider, OAuthTokenExchangeResult } from '../../application/ports/oauth-provider';

interface GoogleIdTokenPayload extends JWTPayload {
  email?: string;
  email_verified?: boolean;
  sub: string;
}

/**
 * Proveedor OAuth 2.0 para Google (Authorization Code + PKCE).
 *
 * 1. Recibe el authorization code + code_verifier del SPA.
 * 2. Intercambia el code por tokens en el endpoint de Google.
 * 3. Verifica la firma del id_token usando el JWKS de Google.
 * 4. Extrae el perfil del usuario (sub, email, email_verified).
 */
export class GoogleOAuthProvider implements OAuthProvider {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly allowedDomains: string[];

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
    allowedDomains: string[],
  ) {
    this.jwks = createRemoteJWKSet(
      new URL('https://www.googleapis.com/oauth2/v3/certs'),
    );
    this.allowedDomains = allowedDomains;
  }

  async exchangeCode(code: string, codeVerifier?: string): Promise<OAuthTokenExchangeResult> {
    if (!codeVerifier) {
      throw new DomainError(
        'PKCE_REQUERIDO',
        'El code_verifier es requerido para la autenticación con Google (PKCE)',
        400,
      );
    }

    // 1. Intercambiar authorization code por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error('[GoogleOAuthProvider] Token exchange failed:', tokenResponse.status, errorBody);
      throw new DomainError(
        'OAUTH_EXCHANGE_FAILED',
        'No se pudo intercambiar el código de autorización con Google',
        400,
      );
    }

    const tokens = await tokenResponse.json() as {
      id_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokens.id_token) {
      throw new DomainError(
        'OAUTH_NO_ID_TOKEN',
        'Google no devolvió un id_token',
        400,
      );
    }

    // 2. Verificar la firma del id_token usando el JWKS de Google
    let payload: GoogleIdTokenPayload;
    try {
      const { payload: verified } = await jwtVerify(tokens.id_token, this.jwks, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: this.clientId,
      });
      payload = verified as GoogleIdTokenPayload;
    } catch (err) {
      console.error('[GoogleOAuthProvider] ID token verification failed:', err);
      throw new DomainError(
        'OAUTH_TOKEN_VERIFICATION_FAILED',
        'No se pudo verificar la identidad del usuario con Google',
        401,
      );
    }

    // 3. Validar que el email esté presente y sea de un dominio permitido
    const email = payload.email;
    if (!email) {
      throw new DomainError(
        'OAUTH_NO_EMAIL',
        'Google no devolvió un correo electrónico',
        400,
      );
    }

    const domain = email.split('@')[1] ?? '';
    if (this.allowedDomains.length > 0 && !this.allowedDomains.includes(domain)) {
      throw new DomainError(
        'DOMINIO_NO_AUTORIZADO',
        'Correo no autorizado. Usa el dominio institucional de la Facultad de Ingeniería.',
        403,
      );
    }

    return {
      sub: payload.sub,
      email,
      emailVerified: payload.email_verified === true,
    };
  }
}
