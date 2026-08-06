import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { DomainError } from '../../domain/errors/domain-error';
import { TokenService } from '../../application/ports/token-service';

interface JwtConfig {
  secret: string;
  expiresIn: string;
  issuer: string;
  audience: string;
}

interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  sid: string;
  iat: number;
  exp: number;
}

/**
 * Implementación de firma/verificación JWT.
 * RF-03 / RNF-05: expiración <= 10 minutos, firma HS256, issuer/audience fijos.
 */
export class JwtTokenService implements TokenService {
  constructor(private readonly config: JwtConfig) {}

  async signAccessToken(payload: {
    sub: string;
    email: string;
    roles: string[];
    sessionId: string;
  }): Promise<{ token: string; expiresAt: Date }> {
    const token = jwt.sign(
      { email: payload.email, roles: payload.roles, sid: payload.sessionId },
      this.config.secret,
      {
        subject: payload.sub,
        expiresIn: this.config.expiresIn as jwt.SignOptions['expiresIn'],
        issuer: this.config.issuer,
        audience: this.config.audience,
      },
    );

    const decoded = jwt.decode(token) as { exp: number };
    return { token, expiresAt: new Date(decoded.exp * 1000) };
  }

  async verifyAccessToken(token: string): Promise<{
    sub: string;
    email: string;
    roles: string[];
    sessionId: string;
    iat: number;
    exp: number;
  }> {
    try {
      const decoded = jwt.verify(token, this.config.secret, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      }) as AccessTokenPayload;

      return {
        sub: decoded.sub,
        email: decoded.email,
        roles: decoded.roles,
        sessionId: decoded.sid,
        iat: decoded.iat,
        exp: decoded.exp,
      };
    } catch (err) {
      const message =
        err instanceof jwt.TokenExpiredError
          ? 'Sesión expirada'
          : 'Sesión inválida';
      const code =
        err instanceof jwt.TokenExpiredError ? 'SESION_EXPIRADA' : 'SESION_INVALIDA';
      throw new DomainError(code, message, 401);
    }
  }

  generateRandomToken(): string {
    return randomBytes(32).toString('hex');
  }
}
