import { VerificationToken } from '../../domain/entities/verification-token';

export interface VerificationTokenRepository {
  save(token: VerificationToken): Promise<VerificationToken>;
  findByToken(token: string): Promise<VerificationToken | null>;
  markUsed(token: string): Promise<VerificationToken | null>;
}
