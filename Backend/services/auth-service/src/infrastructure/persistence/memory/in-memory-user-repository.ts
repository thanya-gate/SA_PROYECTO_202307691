import { User } from '../../../domain/entities/user';
import { Role } from '../../../domain/enums/role';
import { DomainError } from '../../../domain/errors/domain-error';
import { UserRepository, UpdateProfileData } from '../../../application/ports/user-repository';
import { SolicitudEstado, SolicitudRol } from '../../../domain/entities/solicitud-rol';

/**
 * Implementación en memoria del repositorio de usuarios.
 * Sustituto temporal de la BD (patrón Database per Microservice).
 * Al existir PostgreSQL, reemplazar por una implementación que llame a los
 * objetos programables del DER (sp_registrar_usuario, sp_asignar_rol, ...).
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, User>();
  private readonly emailIndex = new Map<string, string>();
  private readonly solicitudes = new Map<string, SolicitudRol>();
  private solicitudSeq = 0;

  async save(user: User): Promise<User> {
    this.store.set(user.userId, user);
    this.emailIndex.set(user.email, user.userId);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    const id = this.emailIndex.get(email.toLowerCase());
    if (!id) return null;
    return this.store.get(id) ?? null;
  }

  async findById(userId: string): Promise<User | null> {
    return this.store.get(userId) ?? null;
  }

  async findByCarnet(carnet: string): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.carnet === carnet) return user;
    }
    return null;
  }

  async findByDpi(dpi: string): Promise<User | null> {
    for (const user of this.store.values()) {
      if (user.dpi === dpi) return user;
    }
    return null;
  }

  async findByRoles(roles: Role[]): Promise<User[]> {
    const wanted = new Set(roles);
    return [...this.store.values()].filter((u) => u.roles.some((r) => wanted.has(r)));
  }

  async addRole(userId: string, role: Role): Promise<User> {
    const user = await this.requireUser(userId);
    const updated: User = { ...user, roles: [...user.roles, role], updatedAt: new Date() };
    this.store.set(userId, updated);
    return updated;
  }

  async removeRole(userId: string, role: Role): Promise<User> {
    const user = await this.requireUser(userId);
    const updated: User = {
      ...user,
      roles: user.roles.filter((r) => r !== role),
      updatedAt: new Date(),
    };
    this.store.set(userId, updated);
    return updated;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<User> {
    const user = await this.requireUser(userId);
    const updated: User = { ...user, passwordHash, updatedAt: new Date() };
    this.store.set(userId, updated);
    return updated;
  }

  async updateProfile(userId: string, data: UpdateProfileData): Promise<User> {
    const user = await this.requireUser(userId);
    const updated: User = {
      ...user,
      nombres: data.nombres !== undefined ? data.nombres : user.nombres,
      apellidos: data.apellidos !== undefined ? data.apellidos : user.apellidos,
      carnet: data.carnet !== undefined ? data.carnet : user.carnet,
      dpi: data.dpi !== undefined ? data.dpi : user.dpi,
      fechaNacimiento: data.fechaNacimiento !== undefined ? data.fechaNacimiento : user.fechaNacimiento,
      telefonoCelular: data.telefonoCelular !== undefined ? data.telefonoCelular : user.telefonoCelular,
      carrera: data.carrera !== undefined ? data.carrera : user.carrera,
      updatedAt: new Date(),
    };
    this.store.set(userId, updated);
    return updated;
  }

  async markEmailVerified(userId: string): Promise<User> {
    const user = await this.requireUser(userId);
    const updated: User = { ...user, emailVerified: true, updatedAt: new Date() };
    this.store.set(userId, updated);
    return updated;
  }

  async linkOAuthProvider(userId: string, provider: string): Promise<User> {
    const user = await this.requireUser(userId);
    if (!user.oauthProviders.includes(provider)) {
      const updated: User = {
        ...user,
        oauthProviders: [...user.oauthProviders, provider],
        updatedAt: new Date(),
      };
      this.store.set(userId, updated);
      return updated;
    }
    return user;
  }

  async findByOAuthIdentity(provider: string, email: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (user && user.oauthProviders.includes(provider)) return user;
    return null;
  }

  async crearSolicitudRol(usuarioId: string, rolSolicitado: Role): Promise<SolicitudRol> {
    const user = await this.requireUser(usuarioId);
    if (rolSolicitado !== Role.CATEDRATICO && rolSolicitado !== Role.AUXILIAR) {
      throw new DomainError('ROL_INVALIDO', 'Solo se puede solicitar el rol CATEDRATICO o AUXILIAR', 400);
    }
    if (user.roles.includes(rolSolicitado)) {
      throw new DomainError('ROL_YA_ASIGNADO', 'El usuario ya posee ese rol', 409);
    }
    const duplicada = [...this.solicitudes.values()].some(
      (s) =>
        s.usuarioId === usuarioId &&
        s.rolSolicitado === rolSolicitado &&
        s.estado === 'PENDIENTE',
    );
    if (duplicada) {
      throw new DomainError('SOLICITUD_DUPLICADA', 'Ya existe una solicitud pendiente para ese rol', 409);
    }
    const solicitud: SolicitudRol = {
      solicitudId: `sol-${++this.solicitudSeq}`,
      usuarioId,
      correo: user.email,
      nombres: user.nombres ?? null,
      apellidos: user.apellidos ?? null,
      carnet: user.carnet ?? null,
      rolSolicitado,
      estado: 'PENDIENTE',
      fechaSolicitud: new Date(),
      fechaResolucion: null,
      resueltoPor: null,
    };
    this.solicitudes.set(solicitud.solicitudId, solicitud);
    return solicitud;
  }

  async listarSolicitudesRol(estado?: SolicitudEstado): Promise<SolicitudRol[]> {
    const filtradas = estado
      ? [...this.solicitudes.values()].filter((s) => s.estado === estado)
      : [...this.solicitudes.values()];
    return filtradas.sort((a, b) => b.fechaSolicitud.getTime() - a.fechaSolicitud.getTime());
  }

  async resolverSolicitudRol(
    solicitudId: string,
    aprobado: boolean,
    resueltoPor: string,
  ): Promise<SolicitudRol> {
    const solicitud = this.solicitudes.get(solicitudId);
    if (!solicitud) {
      throw new DomainError('SOLICITUD_NO_ENCONTRADA', 'Solicitud de rol no encontrada', 404);
    }
    if (solicitud.estado !== 'PENDIENTE') {
      throw new DomainError('SOLICITUD_RESUELTA', 'La solicitud ya fue resuelta', 409);
    }
    const updated: SolicitudRol = {
      ...solicitud,
      estado: aprobado ? 'ACEPTADA' : 'RECHAZADA',
      fechaResolucion: new Date(),
      resueltoPor,
    };
    this.solicitudes.set(solicitudId, updated);
    if (aprobado) {
      await this.addRole(solicitud.usuarioId, solicitud.rolSolicitado);
    }
    return updated;
  }

  private async requireUser(userId: string): Promise<User> {
    const user = this.store.get(userId);
    if (!user) {
      throw new DomainError('USUARIO_NO_ENCONTRADO', 'Usuario no encontrado', 404);
    }
    return user;
  }
}
