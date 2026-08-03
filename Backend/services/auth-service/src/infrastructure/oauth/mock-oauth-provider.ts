import { randomBytes } from 'crypto';
import { DomainError } from '../../domain/errors/domain-error';
import { Role } from '../../domain/enums/role';
import { OAuthProfile } from '../../application/services/auth.service';

/**
 * Proveedor OAuth 2.0 institucional (mock).
 *
 * Simula el proveedor federado de la universidad (RF-04 / CDU0001.3):
 *  - authorize(email): genera un authorization code (como si el usuario ya
 *    se autenticó en la pantalla del proveedor institucional).
 *  - exchange(code): intercambia el código por el perfil federado (id_token).
 *
 * Para el proveedor real (p.ej. Microsoft Entra / Google Workspace institucional):
 *  sustituir por el flujo Authorization Code + verificación del id_token JWT
 *  contra OAUTH_ISSUER_URL (JWKS) y validación de audiencia.
 */
export class MockOAuthProvider {
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
