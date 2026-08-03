import { Role, rolesPermiten } from '../../domain/enums/role';
import { DomainError } from '../../domain/errors/domain-error';
import { UserRepository } from '../ports/user-repository';
import { SessionService } from './session.service';

export interface ProfileView {
  userId: string;
  email: string;
  roles: Role[];
}


export class ProfileService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionService,
  ) {}

  async getProfiles(userId: string): Promise<ProfileView> {
    const user = await this.requireUser(userId);
    return { userId: user.userId, email: user.email, roles: user.roles };
  }

  async assignRole(userId: string, role: Role): Promise<ProfileView> {
    const user = await this.requireUser(userId);
    if (user.roles.includes(role)) {
      throw new DomainError('CONFLICTO_ALMACENAMIENTO', 'El usuario ya posee ese rol', 409);
    }
    const updated = await this.users.addRole(userId, role);
    return { userId: updated.userId, email: updated.email, roles: updated.roles };
  }

  async removeRole(userId: string, role: Role): Promise<ProfileView> {
    const user = await this.requireUser(userId);
    if (user.roles.length <= 1) {
      throw new DomainError(
        'ROL_INVALIDO',
        'El usuario debe conservar al menos un rol',
        400,
      );
    }
    if (!user.roles.includes(role)) {
      throw new DomainError('ROL_INVALIDO', 'El usuario no posee ese rol', 400);
    }
    const updated = await this.users.removeRole(userId, role);
    return { userId: updated.userId, email: updated.email, roles: updated.roles };
  }

  async switchActiveProfile(userId: string, role: Role, sessionId: string): Promise<void> {
    const user = await this.requireUser(userId);
    if (!user.roles.includes(role)) {
      throw new DomainError('ROL_INVALIDO', 'El usuario no posee ese rol', 400);
    }
    await this.sessions.revoke(sessionId);
  }

  async checkPermission(userId: string, resource: string, action: string): Promise<boolean> {
    const user = await this.requireUser(userId);
    return rolesPermiten(user.roles, resource, action);
  }

  private async requireUser(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new DomainError('USUARIO_NO_ENCONTRADO', 'Usuario no encontrado', 404);
    }
    return user;
  }
}
