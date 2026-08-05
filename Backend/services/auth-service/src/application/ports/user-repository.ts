import { User } from '../../domain/entities/user';
import { Role } from '../../domain/enums/role';

/**
 * Puerto de persistencia de Usuarios.
 * La implementación en memoria permite avanzar sin BD; al existir la BD
 * (patrón Database per Microservice), se sustituye por una implementación
 * sobre PostgreSQL sin tocar la capa de aplicación.
 */
export interface UserRepository {
  save(user: User): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(userId: string): Promise<User | null>;
  findByCarnet(carnet: string): Promise<User | null>;
  findByDpi(dpi: string): Promise<User | null>;
  addRole(userId: string, role: Role): Promise<User>;
  removeRole(userId: string, role: Role): Promise<User>;
  updatePassword(userId: string, passwordHash: string): Promise<User>;
  markEmailVerified(userId: string): Promise<User>;
  linkOAuthProvider(userId: string, provider: string): Promise<User>;
  findByOAuthIdentity(provider: string, email: string): Promise<User | null>;
}
