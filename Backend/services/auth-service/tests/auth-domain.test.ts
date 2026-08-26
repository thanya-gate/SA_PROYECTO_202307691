import { z } from 'zod';
import {
  assignRoleSchema,
  changePasswordSchema,
  crearSolicitudRolSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '../src/application/dto/auth-schemas';
import { EmailDomainValidator } from '../src/domain/services/email-domain-validator';
import { DomainError } from '../src/domain/errors/domain-error';
import { Role, rolesPermiten } from '../src/domain/enums/role';

describe('validación y reglas de dominio de autenticación', () => {
  const validStudent = {
    email: 'ESTUDIANTE@INGENIERIA.USAC.EDU.GT',
    password: 'secreto-123',
    confirmPassword: 'secreto-123',
    rol: Role.ESTUDIANTE,
    carnet: '20230001',
    dpi: '1234567890123',
    fechaNacimiento: '2000-01-01',
  };

  test('normaliza y acepta un correo institucional', () => {
    const validator = new EmailDomainValidator(['ingenieria.usac.edu.gt', 'ing.usac.edu.gt']);
    expect(validator.validate('  Persona@ING.USAC.EDU.GT ')).toBe('persona@ing.usac.edu.gt');
  });

  test.each([
    ['dominio personal', 'persona@gmail.com'],
    ['correo sin dominio', 'persona@'],
    ['cadena vacía', ''],
  ])('rechaza %s sin consultar dependencias', (_name, email) => {
    const validator = new EmailDomainValidator(['ingenieria.usac.edu.gt']);
    expect(() => validator.validate(email)).toThrow(
      expect.objectContaining({ code: 'DOMINIO_NO_AUTORIZADO', httpStatus: 403 }),
    );
  });

  test('acepta registro de estudiante y aplica valores por defecto', () => {
    const parsed = registerSchema.parse(validStudent);
    expect(parsed.rol).toBe(Role.ESTUDIANTE);
    expect(parsed.requiereAutorizacion).toBeUndefined();
  });

  test.each([
    ['contraseña corta', { password: '123', confirmPassword: '123' }],
    ['confirmación distinta', { confirmPassword: 'otra-123' }],
    ['carnet inválido', { carnet: 'abc' }],
    ['DPI inválido', { dpi: '123' }],
    ['fecha futura', { fechaNacimiento: '2999-01-01' }],
    ['correo inválido', { email: 'no-es-correo' }],
  ])('rechaza %s', (_name, overrides) => {
    expect(registerSchema.safeParse({ ...validStudent, ...overrides }).success).toBe(false);
  });

  test('permite registro docente pendiente sin exigir carnet numérico', () => {
    expect(registerSchema.parse({
      ...validStudent,
      rol: Role.CATEDRATICO,
      carnet: '',
      requiereAutorizacion: true,
    }).rol).toBe(Role.CATEDRATICO);
  });

  test('valida login, cambio de contraseña y perfil parcial', () => {
    expect(loginSchema.safeParse({ email: 'a@ing.usac.edu.gt', password: 'x' }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: '12345678' }).success).toBe(true);
    expect(updateProfileSchema.parse({ nombres: '  Grace  ', telefonoCelular: null })).toEqual({
      nombres: 'Grace',
      telefonoCelular: null,
    });
    expect(updateProfileSchema.safeParse({ dpi: 'bad' }).success).toBe(false);
  });

  test('restringe solicitudes de rol a catedrático o auxiliar', () => {
    expect(crearSolicitudRolSchema.safeParse({ rolSolicitado: Role.AUXILIAR }).success).toBe(true);
    expect(crearSolicitudRolSchema.safeParse({ rolSolicitado: Role.ESTUDIANTE }).success).toBe(false);
    expect(assignRoleSchema.safeParse({ role: Role.ADMIN }).success).toBe(true);
  });

  test('aplica la matriz RBAC por recurso y acción', () => {
    expect(rolesPermiten([Role.ESTUDIANTE], 'catalogo', 'leer')).toBe(true);
    expect(rolesPermiten([Role.ESTUDIANTE], 'catalogo', 'publicar')).toBe(false);
    expect(rolesPermiten([Role.CATEDRATICO], 'catalogo', 'publicar')).toBe(true);
    expect(rolesPermiten([Role.ADMIN], 'usuario', 'actualizar_rol')).toBe(true);
    expect(rolesPermiten([Role.ADMIN], 'recurso-inexistente', 'leer')).toBe(false);
  });

  test('conserva el contrato de error de dominio', () => {
    const error = new DomainError('ENTRADA_INVALIDA', 'dato inválido', 400, { campo: 'email' });
    expect(error).toMatchObject({ name: 'DomainError', code: 'ENTRADA_INVALIDA', httpStatus: 400 });
    expect(z.string().safeParse(1).success).toBe(false);
  });
});
