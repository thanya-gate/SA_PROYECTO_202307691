import * as grpc from '@grpc/grpc-js';
import { requireAnyRole, requireRole } from '../src/middleware/requireRole';
import { errorHandler } from '../src/middleware/error-handler';
import { DomainError } from '../src/domain/domain-error';
import { GrpcError } from '../src/grpc/auth-client';

function requestWithRoles(roles: string[]) {
  return { context: { roles } } as any;
}

describe('RBAC de materiales y capítulos', () => {
  test.each([
    ['ROLE_ADMIN', ['ROLE_ADMIN']],
    ['ROLE_CATEDRATICO', ['CATEDRATICO']],
    ['ROLE_AUXILIAR', ['ROLE_AUXILIAR']],
  ])('acepta %s', (required, roles) => {
    const next = jest.fn();
    requireRole(required)(requestWithRoles(roles), {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('rechaza estudiante y sesión inexistente sin continuar', () => {
    for (const roles of [['ROLE_ESTUDIANTE'], []]) {
      const next = jest.fn();
      requireAnyRole('ROLE_ADMIN', 'ROLE_CATEDRATICO', 'ROLE_AUXILIAR')(
        requestWithRoles(roles),
        {} as any,
        next,
      );
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'PERMISO_DENEGADO', httpStatus: 403 }));
    }
  });

  test('normaliza un rol sin prefijo en requireAnyRole', () => {
    const next = jest.fn();
    requireAnyRole('ROLE_ADMIN')(requestWithRoles(['ADMIN']), {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });
});

describe('traducción de errores HTTP', () => {
  function response() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
  }

  test.each([
    [new DomainError('ENTRADA_INVALIDA', 'mal dato', 400), 400],
    [new DomainError('MATERIAL_NO_ENCONTRADO', 'no existe', 404), 404],
    [new DomainError('PERMISO_DENEGADO', 'no permitido', 403), 403],
    [new GrpcError(grpc.status.ALREADY_EXISTS, 'conflicto'), 409],
    [new GrpcError(grpc.status.UNAUTHENTICATED, 'sesión inválida'), 401],
  ])('responde con el estado esperado', (error, status) => {
    const res = response();
    errorHandler(error, {} as any, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(Object) }));
  });
});
