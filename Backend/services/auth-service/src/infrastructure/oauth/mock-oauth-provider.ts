import { randomBytes } from 'crypto';
import { DomainError } from '../../domain/errors/domain-error';
import { Role } from '../../domain/enums/role';
import { OAuthProfile } from '../../application/services/auth.service';
import { OAuthProvider, OAuthTokenExchangeResult } from '../../application/ports/oauth-provider';

/**
 * Proveedor OAuth 2.0 institucional (mock).
 *
 * Simula el proveedor federado de la universidad (RF-04 / CDU0001.3):
 *  - authorize(email): genera un authorization code (como si el usuario ya
 *    se autenticó en la pantalla del proveedor institucional).
 *  - exchangeCode(code): intercambia el código por el perfil federado.
 *
 * Para el proveedor real (p.ej. Google OAuth 2.0):
 *  ver GoogleOAuthProvider que implementa el flujo Authorization Code + PKCE.
 */
export class MockOAuthProvider implements OAuthProvider {
  private readonly codes = new Map<string, { profile: OAuthProfile; expiresAt: number }>();

  constructor(private readonly issuer: string) {}

  authorize(email: string, roles?: string[]): string {
    const code = randomBytes(16).toString('hex');
    this.codes.set(code, {
      profile: {
        sub: `federated-${email.split('@')[0]}`,
        email,
        emailVerified: true,
        roles: roles?.map((r) => r as Role),
      },
      expiresAt: Date.now() + 5 * 60 * 1000, // código válido 5 min
    });
    return code;
  }

  /**
   * Implementación de OAuthProvider: intercambia el code por el perfil.
   * El codeVerifier se ignora en el mock (no aplica PKCE).
   */
  async exchangeCode(code: string, _codeVerifier?: string): Promise<OAuthTokenExchangeResult> {
    const entry = this.codes.get(code);
    if (!entry) {
      throw new DomainError('TOKEN_INVALIDO', 'Código OAuth inválido', 400);
    }
    if (entry.expiresAt < Date.now()) {
      throw new DomainError('TOKEN_EXPIRADO', 'El código OAuth ha expirado', 400);
    }
    this.codes.delete(code);
    return {
      sub: entry.profile.sub,
      email: entry.profile.email,
      emailVerified: entry.profile.emailVerified,
    };
  }

  /**
   * Método legacy para el flujo mock del gateway (genera un code interno).
   * Mantenido para retrocompatibilidad con el Mock IdP.
   */
  exchange(code: string): OAuthProfile {
    const entry = this.codes.get(code);
    if (!entry) {
      throw new DomainError('TOKEN_INVALIDO', 'Código OAuth inválido', 400);
    }
    if (entry.expiresAt < Date.now()) {
      throw new DomainError('TOKEN_EXPIRADO', 'El código OAuth ha expirado', 400);
    }
    this.codes.delete(code);
    return entry.profile;
  }

  get issuerUrl(): string {
    return this.issuer;
  }
}
