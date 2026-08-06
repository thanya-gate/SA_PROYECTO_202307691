import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../../../config/env';
import { DomainError } from '../../../domain/errors/domain-error';

/**
 * Pool de conexiones a PostgreSQL (patrón Database per Microservice).
 * La infraestructura es la única capa que conoce el driver; la capa de
 * aplicación depende únicamente de los puertos (SOLID - DIP).
 */
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
      // eslint-disable-next-line no-console
      console.error('[auth-service] error inesperado del pool de BD:', err);
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

/** Verifica la conectividad con la BD (usado en el arranque). */
export async function pingDb(): Promise<void> {
  await getPool().query('SELECT 1');
}

/** Cierra el pool (shutdown limpio). */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Traduce los errores de PostgreSQL a errores de dominio.
 * Los objetos programables del DER lanzan excepciones con formato
 * "CODIGO: mensaje", lo que permite mantener los mismos códigos que la
 * capa de aplicación (SOLID - no filtrar detalles de infraestructura).
 */
const SP_ERROR_CODES: Record<string, { code: string; httpStatus: number }> = {
  DOMINIO_NO_AUTORIZADO: { code: 'DOMINIO_NO_AUTORIZADO', httpStatus: 403 },
  CORREO_YA_REGISTRADO: { code: 'CORREO_YA_REGISTRADO', httpStatus: 409 },
  ROL_INVALIDO: { code: 'ROL_INVALIDO', httpStatus: 400 },
  USUARIO_NO_ENCONTRADO: { code: 'USUARIO_NO_ENCONTRADO', httpStatus: 404 },
  TOKEN_INVALIDO: { code: 'TOKEN_INVALIDO', httpStatus: 400 },
  TOKEN_EXPIRADO: { code: 'TOKEN_EXPIRADO', httpStatus: 400 },
  CREDENCIALES_INVALIDAS: { code: 'CREDENCIALES_INVALIDAS', httpStatus: 401 },
};

export function toDomainError(err: unknown): DomainError {
  if (err instanceof DomainError) return err;

  const pgErr = err as { code?: string; message?: string; constraint?: string };
  const message = pgErr.message ?? 'Error de base de datos';

  // Excepciones lanzadas por SPs/funciones del DER: "CODIGO: detalle".
  const separator = message.indexOf(':');
  if (separator !== -1) {
    const prefix = message.slice(0, separator).trim().toUpperCase();
    const mapped = SP_ERROR_CODES[prefix];
    if (mapped) {
      return new DomainError(
        mapped.code as DomainError['code'],
        message.slice(separator + 1).trim() || 'Operación no permitida',
        mapped.httpStatus,
      );
    }
  }

  // Códigos nativos de PostgreSQL.
  if (pgErr.code === '23505') {
    const esCorreo = /correo_institucional/i.test(pgErr.constraint ?? '');
    return new DomainError(
      'CORREO_YA_REGISTRADO',
      esCorreo ? 'Ya existe una cuenta con este correo' : 'Conflicto de unicidad',
      409,
    );
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
