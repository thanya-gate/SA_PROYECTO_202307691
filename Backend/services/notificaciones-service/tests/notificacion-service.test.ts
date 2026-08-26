import { NotificacionService } from '../src/application/services/notificacion.service';
import { NotificacionRepository } from '../src/application/ports/notificacion-repository';
import { AuthGrpcClient } from '../src/application/ports/auth-grpc-client';
import { InscripcionGrpcClient } from '../src/application/ports/inscripcion-grpc-client';
import { DomainError } from '../src/domain/errors/domain-error';

const CURSO_CATALOGO_ID = '11111111-1111-4111-8111-111111111111';
const CURSO_INSCRIPCION_ID = '22222222-2222-4222-8222-222222222222';
const USER_1 = '33333333-3333-4333-8333-333333333333';
const USER_2 = '44444444-4444-4444-8444-444444444444';
const USER_3 = '55555555-5555-4555-8555-555555555555';

function makeRepository(): jest.Mocked<NotificacionRepository> {
  return {
    registrarNotificacion: jest.fn().mockResolvedValue({ notificacionId: 'not-1' }),
    listarNotificaciones: jest.fn().mockResolvedValue([]),
    listarPlantillas: jest.fn().mockResolvedValue([]),
    consultarCola: jest.fn().mockResolvedValue([]),
    obtenerPendientes: jest.fn().mockResolvedValue([]),
    marcarEnviada: jest.fn().mockResolvedValue(undefined),
    registrarIntentoFallido: jest.fn().mockResolvedValue(undefined),
    marcarFallidaDefinitiva: jest.fn().mockResolvedValue(undefined),
  };
}

function makeAuthClient(): jest.Mocked<AuthGrpcClient> {
  return {
    obtenerUsuario: jest.fn(async (usuarioId: string) => ({
      usuarioId,
      email: `${usuarioId}@ing.usac.edu.gt`,
      nombres: 'Ada',
      apellidos: 'Lovelace',
    })),
    listarEstudiantes: jest.fn().mockResolvedValue([]),
  };
}

function makeInscripcionClient(): jest.Mocked<InscripcionGrpcClient> {
  return {
    listarEstudiantesDeCurso: jest.fn().mockResolvedValue([]),
    listarCursos: jest.fn().mockResolvedValue([]),
  };
}

const clase = {
  cursoId: CURSO_CATALOGO_ID,
  codigo: 'SA',
  curso: 'Software Avanzado',
  semestre: '2026-2',
  anio: 2026,
  tema: 'Arquitectura',
};

describe('NotificacionService', () => {
  test('registra una notificación válida y rechaza entradas sin tocar el repositorio', async () => {
    const repository = makeRepository();
    const service = new NotificacionService(repository, makeAuthClient(), makeInscripcionClient());

    await expect(service.registrarNotificacion({
      usuarioId: USER_1,
      correoDestino: 'persona@ing.usac.edu.gt',
      plantilla: 'aviso_general',
      tipo: 'AVISO',
      datosContexto: { mensaje: 'hola' },
    })).resolves.toEqual({ notificacionId: 'not-1' });
    expect(repository.registrarNotificacion).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'AVISO' }));

    await expect(service.registrarNotificacion({
      usuarioId: 'bad', correoDestino: '', plantilla: '', tipo: '', datosContexto: {},
    })).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA', httpStatus: 400 });
    expect(repository.registrarNotificacion).toHaveBeenCalledTimes(1);
  });

  test('notifica una nueva clase una sola vez por destinatario e ignora usuarios no resolubles', async () => {
    const repository = makeRepository();
    const auth = makeAuthClient();
    const inscripcion = makeInscripcionClient();
    inscripcion.listarCursos.mockResolvedValue([{ cursoId: CURSO_INSCRIPCION_ID, codigo: 'SA' }]);
    inscripcion.listarEstudiantesDeCurso.mockResolvedValue([USER_1, USER_1, USER_2, USER_3]);
    auth.obtenerUsuario.mockImplementation(async (usuarioId) => {
      if (usuarioId === USER_2) throw new Error('auth no disponible');
      if (usuarioId === USER_3) return null;
      return { usuarioId, email: 'ada@ing.usac.edu.gt', nombres: 'Ada', apellidos: 'Lovelace' };
    });
    const service = new NotificacionService(repository, auth, inscripcion);

    await expect(service.notificarNuevaClase(clase)).resolves.toEqual({
      destinatarioIds: [USER_1],
      notificacionesEncoladas: 1,
    });
    expect(inscripcion.listarEstudiantesDeCurso).toHaveBeenCalledWith(CURSO_INSCRIPCION_ID, '2026-2');
    expect(repository.registrarNotificacion).toHaveBeenCalledWith({
      usuarioId: USER_1,
      correoDestino: 'ada@ing.usac.edu.gt',
      plantilla: 'nueva_clase',
      tipo: 'NUEVA_CLASE',
      datosContexto: { codigo: 'SA', curso: 'Software Avanzado', tema: 'Arquitectura', semestre: '2026-2' },
    });
    expect(auth.obtenerUsuario).toHaveBeenCalledTimes(3);
  });

  test('usa el ID del catálogo como fallback y distingue el aviso de video', async () => {
    const repository = makeRepository();
    const auth = makeAuthClient();
    const inscripcion = makeInscripcionClient();
    inscripcion.listarCursos.mockRejectedValue(new Error('servicio caído'));
    inscripcion.listarEstudiantesDeCurso.mockResolvedValue([USER_1]);
    const service = new NotificacionService(repository, auth, inscripcion);

    await expect(service.notificarVideoSubido(clase)).resolves.toMatchObject({
      destinatarioIds: [USER_1], notificacionesEncoladas: 1,
    });
    expect(inscripcion.listarEstudiantesDeCurso).toHaveBeenCalledWith(CURSO_CATALOGO_ID, '2026-2');
    expect(repository.registrarNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      plantilla: 'video_subido', tipo: 'VIDEO_SUBIDO',
    }));
  });

  test('envía avisos generales a destinatarios explícitos o a todos los estudiantes', async () => {
    const repository = makeRepository();
    const auth = makeAuthClient();
    auth.listarEstudiantes.mockResolvedValue([
      { usuarioId: USER_1, email: 'u1@ing.usac.edu.gt', nombres: 'Ada', apellidos: 'Lovelace' },
      { usuarioId: USER_2, email: 'u2@ing.usac.edu.gt', nombres: 'Alan', apellidos: 'Turing' },
    ]);
    const service = new NotificacionService(repository, auth, makeInscripcionClient());

    await expect(service.registrarAvisoGeneral({ mensaje: '  Mantenimiento  ' })).resolves.toEqual({
      destinatarioIds: [USER_1, USER_2], notificacionesEncoladas: 2,
    });
    expect(auth.listarEstudiantes).toHaveBeenCalled();
    expect(repository.registrarNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      usuarioId: USER_1,
      plantilla: 'aviso_general',
      datosContexto: { nombre: 'Ada Lovelace', mensaje: 'Mantenimiento' },
    }));

    repository.registrarNotificacion.mockClear();
    await expect(service.registrarAvisoGeneral({ mensaje: 'Directo', destinatarioIds: [USER_1, USER_1] }))
      .resolves.toMatchObject({ destinatarioIds: [USER_1], notificacionesEncoladas: 1 });
    expect(auth.obtenerUsuario).toHaveBeenCalledTimes(1);
    expect(auth.listarEstudiantes).toHaveBeenCalledTimes(1);
  });

  test('rechaza los datos de una clase antes de llamar inscripción', async () => {
    const repository = makeRepository();
    const inscripcion = makeInscripcionClient();
    const service = new NotificacionService(repository, makeAuthClient(), inscripcion);

    await expect(service.notificarNuevaClase({ ...clase, cursoId: 'bad' })).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    expect(inscripcion.listarCursos).not.toHaveBeenCalled();
    expect(inscripcion.listarEstudiantesDeCurso).not.toHaveBeenCalled();
    expect(repository.registrarNotificacion).not.toHaveBeenCalled();
  });

  test('delega consultas y operaciones de la cola, validando usuario requerido', async () => {
    const repository = makeRepository();
    const service = new NotificacionService(repository, makeAuthClient(), makeInscripcionClient());

    await expect(service.listarNotificaciones(USER_1, 10)).resolves.toEqual([]);
    await expect(service.listarPlantillas()).resolves.toEqual([]);
    await expect(service.consultarCola(5)).resolves.toEqual([]);
    await expect(service.obtenerPendientes(50, 5)).resolves.toEqual([]);
    await expect(service.marcarEnviada('not-1')).resolves.toBeUndefined();
    await expect(service.registrarIntentoFallido(1, 'timeout')).resolves.toBeUndefined();
    await expect(service.marcarFallidaDefinitiva(1)).resolves.toBeUndefined();
    await expect(service.listarNotificaciones('')).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA' });
    expect(repository.listarNotificaciones).toHaveBeenCalledWith(USER_1, 10);
    expect(repository.consultarCola).toHaveBeenCalledWith(5);
  });

  test('propaga errores de infraestructura solo después de validar la entrada', async () => {
    const repository = makeRepository();
    const failure = new DomainError('CONFLICTO', 'duplicado', 409);
    repository.registrarNotificacion.mockRejectedValue(failure);
    const service = new NotificacionService(repository, makeAuthClient(), makeInscripcionClient());

    await expect(service.registrarNotificacion({
      usuarioId: USER_1, correoDestino: 'u@ing.usac.edu.gt', plantilla: 'x', tipo: 'X', datosContexto: {},
    })).rejects.toBe(failure);
  });
});
