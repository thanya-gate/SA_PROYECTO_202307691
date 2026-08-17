import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../../../config/env';
import { DomainError, DomainErrorCode } from '../../../domain/errors/domain-error';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: config.DB_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: config.DB_CONNECTION_TIMEOUT_MS,
    });
    pool.on('error', (err) => {
      console.error('[notificaciones-service] error inesperado del pool de BD:', err);
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  try {
    return await getPool().query<T>(text, params);
  } catch (err) {
    throw toDomainError(err);
  }
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw toDomainError(err);
  } finally {
    client.release();
  }
}

export async function pingDb(): Promise<void> {
  await getPool().query('SELECT 1');
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

const SP_ERROR_CODES: Record<string, { code: DomainErrorCode; httpStatus: number }> = {
  PLANTILLA_NO_ENCONTRADA: { code: 'PLANTILLA_NO_ENCONTRADA', httpStatus: 404 },
  NOTIFICACION_NO_ENCONTRADA: { code: 'NOTIFICACION_NO_ENCONTRADA', httpStatus: 404 },
  ENTRADA_INVALIDA: { code: 'ENTRADA_INVALIDA', httpStatus: 400 },
  CONFLICTO: { code: 'CONFLICTO', httpStatus: 409 },
};

export function toDomainError(err: unknown): DomainError {
  if (err instanceof DomainError) return err;

  const pgErr = err as { code?: string; message?: string; constraint?: string };
  const message = pgErr.message ?? 'Error de base de datos';

  const separator = message.indexOf(':');
  if (separator !== -1) {
    const prefix = message.slice(0, separator).trim().toUpperCase();
    const mapped = SP_ERROR_CODES[prefix];
    if (mapped) {
      return new DomainError(
        mapped.code,
        message.slice(separator + 1).trim() || 'Operación no permitida',
        mapped.httpStatus,
      );
    }
  }

  if (pgErr.code === '23505') {
    return new DomainError('CONFLICTO', 'Conflicto de unicidad', 409);
  }
  if (pgErr.code === '23503') {
    return new DomainError('ENTRADA_INVALIDA', 'Referencia inválida', 400);
  }
  if (pgErr.code === '28P01' || pgErr.code === '28000') {
    return new DomainError('ERROR_INTERNO', 'No se pudo autenticar con la base de datos', 500);
  }
  if (pgErr.code === 'ECONNREFUSED' || pgErr.code === 'ETIMEDOUT') {
    return new DomainError('ERROR_INTERNO', 'Base de datos no disponible', 503);
  }

  return new DomainError('ERROR_INTERNO', 'Error en la base de datos', 500);
}
