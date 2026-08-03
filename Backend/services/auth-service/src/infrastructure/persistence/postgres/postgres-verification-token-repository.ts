import { VerificationToken } from '../../../domain/entities/verification-token';
import { TokenType, TokenUsageState } from '../../../domain/enums/auth';
import { VerificationTokenRepository } from '../../../application/ports/verification-token-repository';
import { query } from './db';

interface VerificationTokenRow {
  token: string;
  usuario_id: string;
  tipo: string;
  usado: boolean;
  fecha_expiracion: Date;
  fecha_creacion: Date;
  fecha_uso: Date | null;
}

function rowToToken(row: VerificationTokenRow): VerificationToken {
  return {
    token: row.token,
    userId: row.usuario_id,
    type: row.tipo as TokenType,
    state: row.usado ? TokenUsageState.USADO : TokenUsageState.PENDIENTE,
    expiresAt: new Date(row.fecha_expiracion),
    createdAt: new Date(row.fecha_creacion),
    usedAt: row.fecha_uso ? new Date(row.fecha_uso) : undefined,
  };
}

/**
 * Repositorio de tokens de verificación sobre PostgreSQL.
 * El trigger trg_marcar_verificado del DER se encarga de marcar el correo
 * como verificado cuando el token de tipo VERIFICACION_CORREO pasa a `usado`.
 */
export class PostgresVerificationTokenRepository implements VerificationTokenRepository {
  async save(token: VerificationToken): Promise<VerificationToken> {
    await query(
      `INSERT INTO token_verificacion (token, usuario_id, tipo, usado, fecha_expiracion, fecha_creacion)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [token.token, token.userId, token.type, token.state === TokenUsageState.USADO, token.expiresAt, token.createdAt],
    );
    return token;
  }

  async findByToken(token: string): Promise<VerificationToken | null> {
    const result = await query<VerificationTokenRow>(
      `SELECT token, usuario_id, tipo, usado, fecha_expiracion, fecha_creacion, fecha_uso
         FROM token_verificacion WHERE token = $1`,
      [token],
    );
    return result.rows[0] ? rowToToken(result.rows[0]) : null;
  }

  /** Marca el token como usado (dispara trg_marcar_verificado si aplica). */
  async markUsed(token: string): Promise<VerificationToken | null> {
    const result = await query<VerificationTokenRow>(
      `UPDATE token_verificacion SET usado = TRUE, fecha_uso = NOW()
        WHERE token = $1 AND usado = FALSE
        RETURNING token, usuario_id, tipo, usado, fecha_expiracion, fecha_creacion, fecha_uso`,
      [token],
    );
    return result.rows[0] ? rowToToken(result.rows[0]) : null;
  }
}
