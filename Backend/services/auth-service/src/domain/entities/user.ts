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
  nombres?: string | null;
  apellidos?: string | null;
  carnet?: string | null;
  dpi?: string | null;
  fechaNacimiento?: string | null;
  telefonoCelular?: string | null;
  carrera?: string | null;
  /** Indica si la cuenta está activa (borrado lógico) */
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function createUser(params: {
  userId: string;
  email: string;
  passwordHash: string;
  emailVerified?: boolean;
  roles?: Role[];
  nombres?: string | null;
  apellidos?: string | null;
  carnet?: string | null;
  dpi?: string | null;
  fechaNacimiento?: string | null;
  telefonoCelular?: string | null;
  carrera?: string | null;
  activo?: boolean;
}): User {
  return {
    userId: params.userId,
    email: params.email.toLowerCase(),
    passwordHash: params.passwordHash,
    emailVerified: params.emailVerified ?? false,
    // Un arreglo vacío es válido para cuentas que esperan autorización de un
    // administrador (por ejemplo, el registro público de catedráticos).
    // Solo se aplica el rol por defecto cuando el parámetro no fue enviado.
    roles: params.roles !== undefined ? params.roles : [DEFAULT_ROLE],
    oauthProviders: [],
    nombres: params.nombres ?? null,
    apellidos: params.apellidos ?? null,
    carnet: params.carnet ?? null,
    dpi: params.dpi ?? null,
    fechaNacimiento: params.fechaNacimiento ?? null,
    telefonoCelular: params.telefonoCelular ?? null,
    carrera: params.carrera ?? null,
    activo: params.activo ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
