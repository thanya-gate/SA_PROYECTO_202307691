import { z } from 'zod';
import { Role } from '../../domain/enums/role';

export const registerSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export const assignRoleSchema = z.object({
  role: z.nativeEnum(Role, { errorMap: () => ({ message: 'Rol inválido' }) }),
});

export const checkPermissionSchema = z.object({
  resource: z.string().min(1),
  action: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const requestResetSchema = z.object({
  email: z.string().email('Correo inválido'),
});

export const confirmResetSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type CheckPermissionInput = z.infer<typeof checkPermissionSchema>;
