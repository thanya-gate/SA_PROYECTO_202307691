import { Session } from '../../../domain/entities/session';
import { SessionStatus } from '../../../domain/enums/auth';
import { SessionRepository } from '../../../application/ports/session-repository';

/**
 * Implementación en memoria del repositorio de sesiones.
 * Proyección equivalente a vw_sesiones_activas del DER.
 */
export class InMemorySessionRepository implements SessionRepository {
  private readonly store = new Map<string, Session>();

  async save(session: Session): Promise<Session> {
    this.store.set(session.sessionId, session);
    return session;
  }

  async findById(sessionId: string): Promise<Session | null> {
    return this.store.get(sessionId) ?? null;
  }

  async findByUserId(userId: string): Promise<Session[]> {
    return [...this.store.values()].filter((s) => s.userId === userId);
  }

  async revoke(sessionId: string): Promise<Session | null> {
    const session = this.store.get(sessionId);
    if (!session) return null;
    const updated: Session = {
      ...session,
      status: SessionStatus.REVOCADA,
      revokedAt: new Date(),
    };
    this.store.set(sessionId, updated);
    return updated;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    let count = 0;
    for (const [id, session] of this.store) {
      if (session.userId === userId && session.status === SessionStatus.ACTIVA) {
        this.store.set(id, {
          ...session,
          status: SessionStatus.REVOCADA,
          revokedAt: new Date(),
        });
        count++;
      }
    }
    return count;
  }
}
