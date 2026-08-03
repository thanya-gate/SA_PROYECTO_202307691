
export interface TokenService {
  signAccessToken(payload: {
    sub: string;
    email: string;
    roles: string[];
    sessionId: string;
  }): Promise<{ token: string; expiresAt: Date }>;

  verifyAccessToken(token: string): Promise<{
    sub: string;
    email: string;
    roles: string[];
    sessionId: string;
    iat: number;
    exp: number;
  }>;

  generateRandomToken(): string;
}

export interface PasswordService {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}
