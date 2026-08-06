import { VerificationToken } from '../../../domain/entities/verification-token';
import { TokenUsageState } from '../../../domain/enums/auth';
import { VerificationTokenRepository } from '../../../application/ports/verification-token-repository';

/** Implementación en memoria de tokens de verificación. */
export class InMemoryVerificationTokenRepository implements VerificationTokenRepository {
  private readonly store = new Map<string, VerificationToken>();

  async save(token: VerificationToken): Promise<VerificationToken> {
    this.store.set(token.token, token);
    return token;
  }

  async findByToken(token: string): Promise<VerificationToken | null> {
    return this.store.get(token) ?? null;
  }

  async markUsed(token: string): Promise<VerificationToken | null> {
    const record = this.store.get(token);
    if (!record) return null;
    const updated: VerificationToken = {
      ...record,
      state: TokenUsageState.USADO,
      usedAt: new Date(),
    };
    this.store.set(token, updated);
    return updated;
  }
}
