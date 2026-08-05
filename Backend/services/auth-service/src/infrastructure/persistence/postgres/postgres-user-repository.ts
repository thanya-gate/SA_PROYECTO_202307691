import { User } from '../../../domain/entities/user';
import { Role } from '../../../domain/enums/role';
import { DomainError } from '../../../domain/errors/domain-error';
import { UserRepository } from '../../../application/ports/user-repository';
import { query } from './db';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  activo: boolean;
  proveedor_oauth: string | null;
  carnet: string | null;
  dpi: string | null;
  fecha_nacimiento: Date | string | null;
  roles: string[];
  created_at: Date;
  updated_at: Date;
}

const USER_SELECT = `
  SELECT
    u.id,
    u.correo_institucional AS email,
    u.contraseña AS password_hash,
    u.email_verificado AS email_verified,
    u.activo,
    u.proveedor_oauth,
    u.carnet,
    u.dpi,
    u.fecha_nacimiento,
    COALESCE((
      SELECT array_agg(r.nombre ORDER BY r.nombre)
      FROM usuario_rol ur
      JOIN rol r ON r.id = ur.rol_id
      WHERE ur.usuario_id = u.id
    ), '{}') AS roles,
    u.fecha_creacion AS created_at,
    u.fecha_actualizacion AS updated_at
  FROM usuario u
`;

function rowToUser(row: UserRow): User {
  return {
    userId: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    emailVerified: row.email_verified,
    roles: (row.roles ?? []).map((r) => r as Role),
    oauthProviders: row.proveedor_oauth ? [row.proveedor_oauth] : [],
    carnet: row.carnet ?? null,
    dpi: row.dpi ?? null,
    fechaNacimiento: row.fecha_nacimiento
      ? new Date(row.fecha_nacimiento).toISOString().slice(0, 10)
      : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Repositorio de usuarios sobre PostgreSQL (patrón Database per Microservice).
 *
 * Reutiliza los objetos programables del DER (Backend/sql/auth.sql):
 *  - sp_registrar_usuario  -> base de la inserción de una cuenta nueva
 *  - sp_asignar_rol        -> addRole()
 *  - sp_cambiar_password   -> updatePassword()
 *  - sp_vincular_cuenta_oauth -> linkOAuthProvider()
 *  - vw_usuarios_activos_roles -> lectura de perfiles
 *  - trg_auditoria_*       -> auditoría automática de cambios de credenciales/roles
 */
export class PostgresUserRepository implements UserRepository {
  async save(user: User): Promise<User> {
    const existing = await this.findById(user.userId);
    if (existing) {
      await query(
        `UPDATE usuario
            SET correo_institucional = $2,
                contraseña = $3,
                email_verificado = $4,
                activo = TRUE,
                proveedor_oauth = $5,
                carnet = $6,
                dpi = $7,
                fecha_nacimiento = $8,
                fecha_actualizacion = NOW()
          WHERE id = $1`,
        [
          user.userId,
          user.email,
          user.passwordHash,
          user.emailVerified,
          user.oauthProviders[0] ?? null,
          user.carnet ?? null,
          user.dpi ?? null,
          user.fechaNacimiento ?? null,
        ],
      );
    } else {
      await query(
        `INSERT INTO usuario (id, correo_institucional, contraseña, email_verificado, activo, proveedor_oauth, carnet, dpi, fecha_nacimiento)
         VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, $8)`,
        [
          user.userId,
          user.email,
          user.passwordHash,
          user.emailVerified,
          user.oauthProviders[0] ?? null,
          user.carnet ?? null,
          user.dpi ?? null,
          user.fechaNacimiento ?? null,
        ],
      );
    }
    await this.syncRoles(user.userId, user.roles);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await query<UserRow>(
      `${USER_SELECT} WHERE u.correo_institucional = $1`,
      [email.toLowerCase()],
    );
    return result.rows[0] ? rowToUser(result.rows[0]) : null;
  }

  async findById(userId: string): Promise<User | null> {
    const result = await query<UserRow>(`${USER_SELECT} WHERE u.id = $1`, [userId]);
    return result.rows[0] ? rowToUser(result.rows[0]) : null;
  }

  async findByCarnet(carnet: string): Promise<User | null> {
    const result = await query<UserRow>(
      `${USER_SELECT} WHERE u.carnet = $1`,
      [carnet],
    );
    return result.rows[0] ? rowToUser(result.rows[0]) : null;
  }

  async findByDpi(dpi: string): Promise<User | null> {
    const result = await query<UserRow>(
      `${USER_SELECT} WHERE u.dpi = $1`,
      [dpi],
    );
    return result.rows[0] ? rowToUser(result.rows[0]) : null;
  }

  /** sp_asignar_rol: otorga un rol adicional (multiperfil). */
  async addRole(userId: string, role: Role): Promise<User> {
    await query('CALL sp_asignar_rol($1, $2)', [userId, role]);
    const updated = await this.requireUser(userId);
    return updated;
  }

  /** Quita un rol (sin procedimiento dedicado en el DER, se realiza directo). */
  async removeRole(userId: string, role: Role): Promise<User> {
    await query(
      `DELETE FROM usuario_rol ur USING rol r
        WHERE ur.rol_id = r.id
          AND ur.usuario_id = $1
          AND r.nombre = $2`,
      [userId, role],
    );
    const updated = await this.requireUser(userId);
    return updated;
  }

  /** sp_cambiar_password: actualización de credenciales (trg_auditoria_password). */
  async updatePassword(userId: string, passwordHash: string): Promise<User> {
    await query('CALL sp_cambiar_password($1, $2)', [userId, passwordHash]);
    return this.requireUser(userId);
  }

  async markEmailVerified(userId: string): Promise<User> {
    await query(
      `UPDATE usuario SET email_verificado = TRUE, fecha_actualizacion = NOW() WHERE id = $1`,
      [userId],
    );
    return this.requireUser(userId);
  }

  /** sp_vincular_cuenta_oauth: vincula el proveedor federado institucional. */
  async linkOAuthProvider(userId: string, provider: string): Promise<User> {
    const user = await this.requireUser(userId);
    await query('CALL sp_vincular_cuenta_oauth($1, $2, NULL)', [user.email, provider]);
    return this.requireUser(userId);
  }

  async findByOAuthIdentity(provider: string, email: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (user && user.oauthProviders.includes(provider)) return user;
    return null;
  }

  private async syncRoles(userId: string, roles: Role[]): Promise<void> {
    await query(
      `INSERT INTO usuario_rol (usuario_id, rol_id)
       SELECT $1, id FROM rol WHERE nombre = ANY($2::text[])
       ON CONFLICT (usuario_id, rol_id) DO NOTHING`,
      [userId, roles],
    );
    await query(
      `DELETE FROM usuario_rol ur USING rol r
        WHERE ur.rol_id = r.id
          AND ur.usuario_id = $1
          AND NOT (r.nombre = ANY($2::text[]))`,
      [userId, roles],
    );
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) {
      throw new DomainError('USUARIO_NO_ENCONTRADO', 'Usuario no encontrado', 404);
    }
    return user;
  }
}
