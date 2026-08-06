import { z } from 'zod';
import { Role } from '../../domain/enums/role';

export const registerSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmPassword: z.string(),
  rol: z.enum([Role.ESTUDIANTE, Role.CATEDRATICO]).default(Role.ESTUDIANTE),
  carnet: z.string(),
  dpi: z.string().regex(/^\d{13}$/, 'DPI inválido (debe tener 13 dígitos)'),
  fechaNacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de nacimiento inválida'),
}).superRefine((d, ctx) => {
  if (d.rol === Role.ESTUDIANTE && !/^\d{8,10}$/.test(d.carnet)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['carnet'],
      message: 'Carnet inválido (debe tener de 8 a 10 dígitos)',
    });
  }
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
}).refine((d) => {
  const fecha = new Date(`${d.fechaNacimiento}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.getTime() <= Date.now();
}, {
  message: 'La fecha de nacimiento no puede ser futura',
  path: ['fechaNacimiento'],
});

export const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export const assignRoleSchema = z.object({
  role: z.nativeEnum(Role, { errorMap: () => ({ message: 'Rol inválido' }) }),
});

export const updateProfileSchema = z.object({
  nombres: z.string().trim().min(1, 'Nombres requeridos').max(120, 'Nombres muy largos').optional(),
  apellidos: z.string().trim().min(1, 'Apellidos requeridos').max(120, 'Apellidos muy largos').optional(),
  carnet: z
    .string()
    .regex(/^\d{8,10}$/, 'Carnet inválido (debe tener de 8 a 10 dígitos)')
    .optional()
    .nullable(),
  dpi: z
    .string()
    .regex(/^\d{13}$/, 'DPI inválido (debe tener 13 dígitos)')
    .optional()
    .nullable(),
  fechaNacimiento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de nacimiento inválida')
    .optional()
    .nullable(),
  telefonoCelular: z.string().regex(/^\d{8,20}$/, 'Teléfono inválido').optional().nullable(),
  carrera: z.string().trim().max(120, 'Carrera muy larga').optional().nullable(),
}).refine((d) => {
  if (!d.fechaNacimiento) return true;
  const fecha = new Date(`${d.fechaNacimiento}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.getTime() <= Date.now();
}, {
  message: 'La fecha de nacimiento no puede ser futura',
  path: ['fechaNacimiento'],
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
