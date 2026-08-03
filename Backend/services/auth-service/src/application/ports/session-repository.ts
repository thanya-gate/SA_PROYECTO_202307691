import { Session } from '../../domain/entities/session';

export interface SessionRepository {
  save(session: Session): Promise<Session>;
  findById(sessionId: string): Promise<Session | null>;
  findByUserId(userId: string): Promise<Session[]>;
  revoke(sessionId: string): Promise<Session | null>;
  revokeAllForUser(userId: string): Promise<number>;
}
