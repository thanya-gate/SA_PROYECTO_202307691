import { Role } from '../enums/role';
import { DEFAULT_ROLE } from '../enums/role';

/**
 * Entidad Usuario.
 * Refleja la tabla `usuario` del DER del Auth Service.
 */
export interface User {
  userId: string;
  email: string;
  /** hash de la contraseña (bcrypt) */
  passwordHash: string;
  emailVerified: boolean;
  /** Perfiles/roles activos (multiperfil) */
  roles: Role[];
  /** Proveedores OAuth vinculados (p.ej. 'institucional') */
  oauthProviders: string[];
  /** Datos del estudiante (opcionales para cuentas OAuth/admin) */
  carnet?: string | null;
  dpi?: string | null;
  fechaNacimiento?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createUser(params: {
  userId: string;
  email: string;
  passwordHash: string;
  emailVerified?: boolean;
  roles?: Role[];
  carnet?: string | null;
  dpi?: string | null;
  fechaNacimiento?: string | null;
}): User {
  return {
    userId: params.userId,
    email: params.email.toLowerCase(),
    passwordHash: params.passwordHash,
    emailVerified: params.emailVerified ?? false,
    roles: params.roles && params.roles.length > 0 ? params.roles : [DEFAULT_ROLE],
    oauthProviders: [],
    carnet: params.carnet ?? null,
    dpi: params.dpi ?? null,
    fechaNacimiento: params.fechaNacimiento ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
