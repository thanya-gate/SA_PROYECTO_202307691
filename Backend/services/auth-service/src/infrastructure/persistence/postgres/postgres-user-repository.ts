import { User } from '../../../domain/entities/user';
import { Role } from '../../../domain/enums/role';
import { DomainError } from '../../../domain/errors/domain-error';
import { UpdateProfileData, UserRepository } from '../../../application/ports/user-repository';
import { SolicitudEstado, SolicitudRol } from '../../../domain/entities/solicitud-rol';
import { query } from './db';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  activo: boolean;
  proveedor_oauth: string | null;
  nombres: string | null;
  apellidos: string | null;
  carnet: string | null;
  dpi: string | null;
  fecha_nacimiento: Date | string | null;
  telefono_celular: string | null;
  carrera: string | null;
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
    u.nombres,
    u.apellidos,
    u.carnet,
    u.dpi,
    u.fecha_nacimiento,
    u.telefono_celular,
    u.carrera,
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
    activo: row.activo,
    nombres: row.nombres ?? null,
    apellidos: row.apellidos ?? null,
    carnet: row.carnet ?? null,
    dpi: row.dpi ?? null,
    fechaNacimiento: row.fecha_nacimiento
      ? new Date(row.fecha_nacimiento).toISOString().slice(0, 10)
      : null,
    telefonoCelular: row.telefono_celular ?? null,
    carrera: row.carrera ?? null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

interface SolicitudRow {
  id: string;
  usuario_id: string;
  correo: string;
  nombres: string | null;
  apellidos: string | null;
  carnet: string | null;
  rol_solicitado: string;
  estado: string;
  fecha_solicitud: Date;
  fecha_resolucion: Date | null;
  resuelto_por: string | null;
}

const SOLICITUD_SELECT = `
  SELECT
    sr.id,
    sr.usuario_id,
    sr.correo_institucional AS correo,
    sr.nombres,
    sr.apellidos,
    sr.carnet,
    sr.rol_solicitado,
    sr.estado,
    sr.fecha_solicitud,
    sr.fecha_resolucion,
    sr.resuelto_por
  FROM vw_solicitudes_rol sr
`;

function rowToSolicitud(row: SolicitudRow): SolicitudRol {
  return {
    solicitudId: row.id,
    usuarioId: row.usuario_id,
    correo: row.correo,
    nombres: row.nombres ?? null,
    apellidos: row.apellidos ?? null,
    carnet: row.carnet ?? null,
    rolSolicitado: row.rol_solicitado as Role,
    estado: row.estado as SolicitudEstado,
    fechaSolicitud: new Date(row.fecha_solicitud),
    fechaResolucion: row.fecha_resolucion ? new Date(row.fecha_resolucion) : null,
    resueltoPor: row.resuelto_por ?? null,
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
 *  - sp_crear_solicitud_rol / sp_resolver_solicitud_rol -> solicitudes de rol
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
                nombres = $6,
                apellidos = $7,
                carnet = $8,
                dpi = $9,
                fecha_nacimiento = $10,
                telefono_celular = $11,
                carrera = $12,
                fecha_actualizacion = NOW()
          WHERE id = $1`,
        [
          user.userId,
          user.email,
          user.passwordHash,
          user.emailVerified,
          user.oauthProviders[0] ?? null,
          user.nombres ?? null,
          user.apellidos ?? null,
          user.carnet ?? null,
          user.dpi ?? null,
          user.fechaNacimiento ?? null,
          user.telefonoCelular ?? null,
          user.carrera ?? null,
        ],
      );
    } else {
      await query(
        `INSERT INTO usuario (id, correo_institucional, contraseña, email_verificado, activo, proveedor_oauth, nombres, apellidos, carnet, dpi, fecha_nacimiento, telefono_celular, carrera)
         VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          user.userId,
          user.email,
          user.passwordHash,
          user.emailVerified,
          user.oauthProviders[0] ?? null,
          user.nombres ?? null,
          user.apellidos ?? null,
          user.carnet ?? null,
          user.dpi ?? null,
          user.fechaNacimiento ?? null,
          user.telefonoCelular ?? null,
          user.carrera ?? null,
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

  async findByRoles(roles: Role[], incluirInactivos?: boolean): Promise<User[]> {
    if (roles.length === 0) return [];
    const filtroActivo = incluirInactivos ? 'TRUE' : 'u.activo = TRUE';
    const result = await query<UserRow>(
      `${USER_SELECT}
       WHERE ${filtroActivo}
         AND u.id IN (
           SELECT ur.usuario_id
           FROM usuario_rol ur
           JOIN rol r ON r.id = ur.rol_id
           WHERE r.nombre = ANY($1::text[])
         )
       ORDER BY u.nombres ASC, u.apellidos ASC`,
      [roles],
    );
    return result.rows.map(rowToUser);
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

  /** Actualiza los datos editables del perfil del usuario. */
  async updateProfile(userId: string, data: UpdateProfileData): Promise<User> {
    await this.requireUser(userId);
    await query(
      `UPDATE usuario
          SET nombres = COALESCE($2, nombres),
              apellidos = COALESCE($3, apellidos),
              carnet = COALESCE($4, carnet),
              dpi = COALESCE($5, dpi),
              fecha_nacimiento = COALESCE($6, fecha_nacimiento),
              telefono_celular = COALESCE($7, telefono_celular),
              carrera = COALESCE($8, carrera),
              fecha_actualizacion = NOW()
        WHERE id = $1`,
      [
        userId,
        data.nombres ?? null,
        data.apellidos ?? null,
        data.carnet ?? null,
        data.dpi ?? null,
        data.fechaNacimiento ?? null,
        data.telefonoCelular ?? null,
        data.carrera ?? null,
      ],
    );
    return this.requireUser(userId);
  }

  async desactivarUsuario(userId: string): Promise<User> {
    await query(`UPDATE usuario SET activo = FALSE, fecha_actualizacion = NOW() WHERE id = $1`, [
      userId,
    ]);
    return this.requireUser(userId);
  }

  async reactivarUsuario(userId: string): Promise<User> {
    await query(`UPDATE usuario SET activo = TRUE, fecha_actualizacion = NOW() WHERE id = $1`, [
      userId,
    ]);
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

  /** sp_crear_solicitud_rol: registra la solicitud de rol pendiente. */
  async crearSolicitudRol(usuarioId: string, rolSolicitado: Role): Promise<SolicitudRol> {
    await query('CALL sp_crear_solicitud_rol($1, $2, NULL)', [usuarioId, rolSolicitado]);
    // El procedimiento devuelve el id por parámetro INOUT (p_solicitud_id);
    // se recupera la solicitud pendiente recién creada de forma robusta.
    const pendiente = await query<SolicitudRow>(
      `${SOLICITUD_SELECT}
        WHERE sr.usuario_id = $1 AND sr.rol_solicitado = $2 AND sr.estado = 'PENDIENTE'
        ORDER BY sr.fecha_solicitud DESC LIMIT 1`,
      [usuarioId, rolSolicitado],
    );
    if (pendiente.rows.length === 0) {
      throw new DomainError('ERROR_INTERNO', 'No se pudo crear la solicitud de rol', 500);
    }
    return rowToSolicitud(pendiente.rows[0]);
  }

  /** Lista las solicitudes de rol (opcionalmente filtradas por estado y/o usuario). */
  async listarSolicitudesRol(estado?: SolicitudEstado, usuarioId?: string): Promise<SolicitudRol[]> {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (estado) {
      params.push(estado);
      condiciones.push(`sr.estado = $${params.length}`);
    }
    if (usuarioId) {
      params.push(usuarioId);
      condiciones.push(`sr.usuario_id = $${params.length}`);
    }
    const where = condiciones.length > 0 ? ` WHERE ${condiciones.join(' AND ')}` : '';
    const res = await query<SolicitudRow>(
      `${SOLICITUD_SELECT}${where} ORDER BY sr.fecha_solicitud DESC`,
      params,
    );
    return res.rows.map(rowToSolicitud);
  }

  /**
   * sp_resolver_solicitud_rol: aprueba o rechaza la solicitud.
   * Si se aprueba, el procedimiento otorga el rol de forma atómica.
   */
  async resolverSolicitudRol(
    solicitudId: string,
    aprobado: boolean,
    resueltoPor: string,
  ): Promise<SolicitudRol> {
    await query('CALL sp_resolver_solicitud_rol($1, $2, $3, NULL, NULL)', [
      solicitudId,
      aprobado,
      resueltoPor,
    ]);
    return this.requireSolicitud(solicitudId);
  }

  private async requireSolicitud(solicitudId: string): Promise<SolicitudRol> {
    const res = await query<SolicitudRow>(`${SOLICITUD_SELECT} WHERE sr.id = $1`, [solicitudId]);
    if (res.rows.length === 0) {
      throw new DomainError('SOLICITUD_NO_ENCONTRADA', 'Solicitud de rol no encontrada', 404);
    }
    return rowToSolicitud(res.rows[0]);
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
