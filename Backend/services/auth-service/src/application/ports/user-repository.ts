import { User } from '../../domain/entities/user';
import { Role } from '../../domain/enums/role';
import { SolicitudEstado, SolicitudRol } from '../../domain/entities/solicitud-rol';

/**
 * Puerto de persistencia de Usuarios.
 * La implementación en memoria permite avanzar sin BD; al existir la BD
 * (patrón Database per Microservice), se sustituye por una implementación
 * sobre PostgreSQL sin tocar la capa de aplicación.
 */
export interface UpdateProfileData {
  nombres?: string | null;
  apellidos?: string | null;
  carnet?: string | null;
  dpi?: string | null;
  fechaNacimiento?: string | null;
  telefonoCelular?: string | null;
  carrera?: string | null;
}

export interface UserRepository {
  save(user: User): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  findById(userId: string): Promise<User | null>;
  findByCarnet(carnet: string): Promise<User | null>;
  findByDpi(dpi: string): Promise<User | null>;
  findByRoles(roles: Role[]): Promise<User[]>;
  addRole(userId: string, role: Role): Promise<User>;
  removeRole(userId: string, role: Role): Promise<User>;
  updatePassword(userId: string, passwordHash: string): Promise<User>;
  updateProfile(userId: string, data: UpdateProfileData): Promise<User>;
  markEmailVerified(userId: string): Promise<User>;
  linkOAuthProvider(userId: string, provider: string): Promise<User>;
  findByOAuthIdentity(provider: string, email: string): Promise<User | null>;

  crearSolicitudRol(usuarioId: string, rolSolicitado: Role): Promise<SolicitudRol>;
  listarSolicitudesRol(estado?: SolicitudEstado): Promise<SolicitudRol[]>;
  resolverSolicitudRol(
    solicitudId: string,
    aprobado: boolean,
    resueltoPor: string,
  ): Promise<SolicitudRol>;
}
