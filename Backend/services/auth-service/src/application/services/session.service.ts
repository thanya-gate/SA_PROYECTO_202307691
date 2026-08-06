import { randomUUID } from 'crypto';
import { Session } from '../../domain/entities/session';
import { SessionStatus } from '../../domain/enums/auth';
import { SessionRepository } from '../ports/session-repository';

export interface CreateSessionParams {
  userId: string;
  ip?: string;
  userAgent?: string;
  ttlMs?: number;
}

export interface ValidatedSession {
  session: Session;
  user: { userId: string };
}


export class SessionService {
  constructor(private readonly sessions: SessionRepository) {}

  async create(params: CreateSessionParams): Promise<Session> {
    const now = new Date();
    const ttlMs = params.ttlMs ?? 60 * 60 * 1000;
    const session: Session = {
      sessionId: randomUUID(),
      userId: params.userId,
      status: SessionStatus.ACTIVA,
      issuedAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
      ip: params.ip,
      userAgent: params.userAgent,
    };
    return this.sessions.save(session);
  }

  async validate(sessionId: string): Promise<ValidatedSession | null> {
    const session = await this.sessions.findById(sessionId);
    if (!session) return null;
    if (session.status === SessionStatus.REVOCADA) return null;

    if (session.expiresAt.getTime() < Date.now()) {
      const expired = { ...session, status: SessionStatus.EXPIRADA };
      await this.sessions.save(expired);
      return null;
    }

    return { session, user: { userId: session.userId } };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.sessions.revoke(sessionId);
  }

  async revokeAllForUser(userId: string): Promise<number> {
    return this.sessions.revokeAllForUser(userId);
  }

  async findActiveByUserId(userId: string): Promise<Session[]> {
    const all = await this.sessions.findByUserId(userId);
    return all.filter(
      (s) =>
        s.status === SessionStatus.ACTIVA &&
        s.expiresAt.getTime() > Date.now(),
    );
  }
}
