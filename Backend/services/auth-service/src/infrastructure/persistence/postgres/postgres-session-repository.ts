import { Session } from '../../../domain/entities/session';
import { SessionStatus } from '../../../domain/enums/auth';
import { SessionRepository } from '../../../application/ports/session-repository';
import { query } from './db';

interface SessionRow {
  id: string;
  usuario_id: string;
  perfil_activo: string | null;
  token_jwt: string | null;
  fecha_inicio: Date;
  fecha_fin: Date | null;
  activa: boolean;
  ip: string | null;
  user_agent: string | null;
}

const SESSION_SELECT = `
  SELECT
    s.id,
    s.usuario_id,
    s.perfil_activo_rol_id,
    s.token_jwt,
    s.fecha_inicio,
    s.fecha_fin,
    s.activa,
    s.ip,
    s.user_agent
  FROM sesion s
`;

function rowToSession(row: SessionRow): Session {
  const now = Date.now();
  let status: SessionStatus;
  if (!row.activa) {
    status = SessionStatus.REVOCADA;
  } else if (row.fecha_fin && new Date(row.fecha_fin).getTime() < now) {
    status = SessionStatus.EXPIRADA;
  } else {
    status = SessionStatus.ACTIVA;
  }
  return {
    sessionId: row.id,
    userId: row.usuario_id,
    status,
    issuedAt: new Date(row.fecha_inicio),
    expiresAt: row.fecha_fin ? new Date(row.fecha_fin) : new Date(row.fecha_inicio),
    ip: row.ip ?? undefined,
    userAgent: row.user_agent ?? undefined,
  };
}

/**
 * Repositorio de sesiones sobre PostgreSQL.
 * Proyección equivalente a vw_sesiones_activas del DER: solo se consideran
 * activas las sesiones con `activa = TRUE` y `fecha_fin` en el futuro.
 */
export class PostgresSessionRepository implements SessionRepository {
  async save(session: Session): Promise<Session> {
    await query(
      `INSERT INTO sesion (id, usuario_id, token_jwt, fecha_inicio, fecha_fin, activa, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE
         SET fecha_fin = EXCLUDED.fecha_fin,
             activa = EXCLUDED.activa,
             ip = EXCLUDED.ip,
             user_agent = EXCLUDED.user_agent`,
      [
        session.sessionId,
        session.userId,
        null,
        session.issuedAt,
        session.expiresAt,
        session.status !== SessionStatus.REVOCADA,
        session.ip ?? null,
        session.userAgent ?? null,
      ],
    );
    return session;
  }

  async findById(sessionId: string): Promise<Session | null> {
    const result = await query<SessionRow>(
      `${SESSION_SELECT} WHERE s.id = $1`,
      [sessionId],
    );
    return result.rows[0] ? rowToSession(result.rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Session[]> {
    const result = await query<SessionRow>(
      `${SESSION_SELECT} WHERE s.usuario_id = $1`,
      [userId],
    );
    return result.rows.map(rowToSession);
  }

  async revoke(sessionId: string): Promise<Session | null> {
    const result = await query<SessionRow>(
      `UPDATE sesion SET activa = FALSE, fecha_fin = NOW()
        WHERE id = $1 AND activa = TRUE
        RETURNING *`,
      [sessionId],
    );
    return result.rows[0] ? rowToSession(result.rows[0]) : null;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await query(
      `UPDATE sesion SET activa = FALSE, fecha_fin = NOW()
        WHERE usuario_id = $1 AND activa = TRUE`,
      [userId],
    );
    return result.rowCount ?? 0;
  }
}
