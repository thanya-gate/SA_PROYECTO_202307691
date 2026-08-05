import { User } from '../../../domain/entities/user';
import { Role } from '../../../domain/enums/role';
import { DomainError } from '../../../domain/errors/domain-error';
import { UserRepository } from '../../../application/ports/user-repository';

/**
 * Implementación en memoria del repositorio de usuarios.
 * Sustituto temporal de la BD (patrón Database per Microservice).
 * Al existir PostgreSQL, reemplazar por una implementación que llame a los
 * objetos programables del DER (sp_registrar_usuario, sp_asignar_rol, ...).
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, User>();
  private readonly emailIndex = new Map<string, string>();

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

  private async requireUser(userId: string): Promise<User> {
    const user = this.store.get(userId);
    if (!user) {
      throw new DomainError('USUARIO_NO_ENCONTRADO', 'Usuario no encontrado', 404);
    }
    return user;
  }
}
