import { CatalogService } from '../src/application/services/catalog.service';
import {
  crearDudaSchema,
  marcarRespuestaVerificadaSchema,
  responderDudaSchema,
} from '../src/application/dto/catalog-schemas';
import type { CatalogRepository } from '../src/application/ports/catalog-repository';

const claseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const autorId = '00000000-0000-0000-0000-000000000101';
const catedraticoId = '00000000-0000-0000-0000-000000000201';
const otroEstudianteId = '00000000-0000-0000-0000-000000000401';
const dudaId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const respuestaId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function duda(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    dudaId,
    claseId,
    autorId,
    posicionSegundos: 300,
    pregunta: '¿Por qué se usa merge sort en esta unidad?',
    resuelta: false,
    fechaCreacion: '2026-09-07T00:00:00.000Z',
    totalRespuestas: 0,
    totalVerificadas: 0,
    respuestas: [],
    ...overrides,
  };
}

function respuesta(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    respuestaId,
    dudaId,
    autorId: catedraticoId,
    contenido: 'Se usa merge sort porque garantiza estabilidad.',
    esVerificada: false,
    verificadaPor: null,
    fechaCreacion: '2026-09-07T00:01:00.000Z',
    ...overrides,
  };
}

describe('DTO del foro de dudas', () => {
  test('crearDudaSchema acepta una duda válida y recorta la pregunta', () => {
    expect(crearDudaSchema.parse({
      claseId,
      autorId,
      posicionSegundos: 0,
      pregunta: '  ¿Duda desde el segundo cero?  ',
    })).toEqual({
      claseId,
      autorId,
      posicionSegundos: 0,
      pregunta: '¿Duda desde el segundo cero?',
    });
  });

  test.each([
    ['UUID de clase inválido', { claseId: 'no-uuid' }],
    ['UUID de autor inválido', { autorId: 'no-uuid' }],
    ['posicionSegundos negativo', { posicionSegundos: -1 }],
    ['posicionSegundos decimal', { posicionSegundos: 5.5 }],
    ['posicionSegundos NaN', { posicionSegundos: Number.NaN }],
    ['pregunta vacía', { pregunta: '   ' }],
    ['pregunta excesiva', { pregunta: 'x'.repeat(2001) }],
  ])('crearDudaSchema rechaza %s', (_caso, overrides) => {
    expect(crearDudaSchema.safeParse({
      claseId,
      autorId,
      posicionSegundos: 300,
      pregunta: 'Pregunta válida',
      ...overrides,
    }).success).toBe(false);
  });

  test('responderDudaSchema exige contenido y UUIDs válidos', () => {
    const base = { dudaId, autorId, contenido: 'Respuesta' };
    expect(responderDudaSchema.parse(base)).toEqual(base);
    expect(responderDudaSchema.safeParse({ ...base, contenido: '   ' }).success).toBe(false);
    expect(responderDudaSchema.safeParse({ ...base, dudaId: 'bad' }).success).toBe(false);
    expect(responderDudaSchema.safeParse({ ...base, autorId: 'bad' }).success).toBe(false);
  });

  test('marcarRespuestaVerificadaSchema asume false para el permiso docente', () => {
    const parsed = marcarRespuestaVerificadaSchema.parse({ respuestaId, verificadorId: autorId });
    expect(parsed.puedeVerificarComoDocente).toBe(false);
    expect(marcarRespuestaVerificadaSchema.safeParse({ respuestaId: 'bad', verificadorId: autorId }).success).toBe(false);
  });
});

describe('CatalogService: crear duda', () => {
  function makeRepository() {
    const crearDuda = jest.fn().mockResolvedValue(duda());
    const repository = { crearDuda } as unknown as CatalogRepository;
    return { repository, crearDuda };
  }

  test('crea la duda y la devuelve con el segundo del video', async () => {
    const { repository, crearDuda } = makeRepository();
    const service = new CatalogService(repository);

    await expect(service.crearDuda({
      claseId,
      autorId,
      posicionSegundos: 300,
      pregunta: '¿Por qué se usa merge sort?',
    })).resolves.toMatchObject({ dudaId, posicionSegundos: 300 });
    expect(crearDuda).toHaveBeenCalledWith({
      claseId,
      autorId,
      posicionSegundos: 300,
      pregunta: '¿Por qué se usa merge sort?',
    });
  });

  test('rechaza entradas inválidas sin invocar el repositorio', async () => {
    const { repository, crearDuda } = makeRepository();
    const service = new CatalogService(repository);

    await expect(service.crearDuda({
      claseId: 'bad',
      autorId,
      posicionSegundos: 300,
      pregunta: 'Pregunta',
    })).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA', httpStatus: 400 });
    expect(crearDuda).not.toHaveBeenCalled();
  });

  test('informa ENTRADA_INVALIDA si el repositorio no devuelve la duda', async () => {
    const { repository, crearDuda } = makeRepository();
    crearDuda.mockResolvedValueOnce(null as never);
    const service = new CatalogService(repository);

    await expect(service.crearDuda({
      claseId,
      autorId,
      posicionSegundos: 0,
      pregunta: 'Pregunta',
    })).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA', httpStatus: 400 });
  });

  test.each([
    ['CLASE_NO_ENCONTRADA: la clase no existe', 'CLASE_NO_ENCONTRADA', 404],
    ['ENTRADA_INVALIDA: la clase no admite dudas', 'ENTRADA_INVALIDA: video sin publicar', 400],
  ])('traduce errores SQL de creación: %s', async (_mensaje, raw, httpStatus) => {
    const { repository, crearDuda } = makeRepository();
    crearDuda.mockRejectedValue(new Error(raw));
    const service = new CatalogService(repository);

    await expect(service.crearDuda({
      claseId,
      autorId,
      posicionSegundos: 0,
      pregunta: 'Pregunta',
    })).rejects.toMatchObject({ code: httpStatus === 404 ? 'CLASE_NO_ENCONTRADA' : 'ENTRADA_INVALIDA', httpStatus });
  });
});

describe('CatalogService: listar dudas', () => {
  test('delega el listado completo del hilo al repositorio', async () => {
    const listarDudas = jest.fn().mockResolvedValue([duda()]);
    const repository = { listarDudas } as unknown as CatalogRepository;
    const service = new CatalogService(repository);

    await expect(service.listarDudas(claseId)).resolves.toHaveLength(1);
    expect(listarDudas).toHaveBeenCalledWith(claseId);
  });

  test('rechaza una clase vacía sin consultar el repositorio', async () => {
    const listarDudas = jest.fn();
    const repository = { listarDudas } as unknown as CatalogRepository;
    const service = new CatalogService(repository);

    await expect(service.listarDudas('')).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA', httpStatus: 400 });
    expect(listarDudas).not.toHaveBeenCalled();
  });
});

describe('CatalogService: responder duda', () => {
  function makeRepository() {
    const responderDuda = jest.fn().mockResolvedValue(respuesta());
    const repository = { responderDuda } as unknown as CatalogRepository;
    return { repository, responderDuda };
  }

  test('publica la respuesta y la devuelve', async () => {
    const { repository, responderDuda } = makeRepository();
    const service = new CatalogService(repository);

    await expect(service.responderDuda({
      dudaId,
      autorId: catedraticoId,
      contenido: 'Se usa merge sort porque garantiza estabilidad.',
    })).resolves.toMatchObject({ respuestaId, autorId: catedraticoId });
    expect(responderDuda).toHaveBeenCalledWith({
      dudaId,
      autorId: catedraticoId,
      contenido: 'Se usa merge sort porque garantiza estabilidad.',
    });
  });

  test('rechaza entradas inválidas sin invocar el repositorio', async () => {
    const { repository, responderDuda } = makeRepository();
    const service = new CatalogService(repository);

    await expect(service.responderDuda({ dudaId: 'bad', autorId, contenido: 'x' }))
      .rejects.toMatchObject({ code: 'ENTRADA_INVALIDA', httpStatus: 400 });
    expect(responderDuda).not.toHaveBeenCalled();
  });

  test('traduce duda inexistente a DUDA_NO_ENCONTRADA', async () => {
    const { repository, responderDuda } = makeRepository();
    responderDuda.mockRejectedValueOnce(new Error('DUDA_NO_ENCONTRADA'));
    const service = new CatalogService(repository);

    await expect(service.responderDuda({ dudaId, autorId, contenido: 'x' }))
      .rejects.toMatchObject({ code: 'DUDA_NO_ENCONTRADA', httpStatus: 404 });
  });
});

describe('CatalogService: marcar respuesta verificada', () => {
  const dudaResuelta = duda({
    resuelta: true,
    totalRespuestas: 1,
    totalVerificadas: 1,
    respuestas: [respuesta({ esVerificada: true, verificadaPor: catedraticoId })],
  });

  function makeRepository() {
    const obtenerRespuesta = jest.fn().mockResolvedValue(respuesta());
    const obtenerDuda = jest.fn().mockResolvedValueOnce(duda()).mockResolvedValue(dudaResuelta);
    const marcarRespuestaVerificada = jest.fn().mockResolvedValue(
      respuesta({ esVerificada: true, verificadaPor: catedraticoId }),
    );
    const repository = {
      obtenerRespuesta,
      obtenerDuda,
      marcarRespuestaVerificada,
    } as unknown as CatalogRepository;
    return { repository, obtenerRespuesta, obtenerDuda, marcarRespuestaVerificada };
  }

  test('el autor de la duda puede verificar sin ser docente', async () => {
    const { repository, obtenerDuda, marcarRespuestaVerificada } = makeRepository();
    const service = new CatalogService(repository);

    await expect(service.marcarRespuestaVerificada({
      respuestaId,
      verificadorId: autorId,
      puedeVerificarComoDocente: false,
    })).resolves.toMatchObject({ dudaId, resuelta: true });
    expect(marcarRespuestaVerificada).toHaveBeenCalledWith(respuestaId, autorId);
    expect(obtenerDuda).toHaveBeenCalledTimes(2);
  });

  test('el personal docente verifica aunque no sea el autor', async () => {
    const { repository, marcarRespuestaVerificada } = makeRepository();
    const service = new CatalogService(repository);

    await expect(service.marcarRespuestaVerificada({
      respuestaId,
      verificadorId: catedraticoId,
      puedeVerificarComoDocente: true,
    })).resolves.toMatchObject({ resuelta: true });
    expect(marcarRespuestaVerificada).toHaveBeenCalledWith(respuestaId, catedraticoId);
  });

  test('un estudiante ajeno sin permiso docente es rechazado con 403 y no marca nada', async () => {
    const { repository, marcarRespuestaVerificada } = makeRepository();
    const service = new CatalogService(repository);

    await expect(service.marcarRespuestaVerificada({
      respuestaId,
      verificadorId: otroEstudianteId,
      puedeVerificarComoDocente: false,
    })).rejects.toMatchObject({ code: 'SIN_AUTORIZACION', httpStatus: 403 });
    expect(marcarRespuestaVerificada).not.toHaveBeenCalled();
  });

  test('responde 404 si la respuesta o la duda no existen', async () => {
    const { repository } = makeRepository();
    repository.obtenerRespuesta = jest.fn().mockResolvedValueOnce(null) as never;
    let service = new CatalogService(repository);
    await expect(service.marcarRespuestaVerificada({ respuestaId, verificadorId: autorId, puedeVerificarComoDocente: false }))
      .rejects.toMatchObject({ code: 'RESPUESTA_NO_ENCONTRADA', httpStatus: 404 });

    repository.obtenerRespuesta = jest.fn().mockResolvedValue(respuesta()) as never;
    repository.obtenerDuda = jest.fn().mockResolvedValueOnce(null) as never;
    service = new CatalogService(repository);
    await expect(service.marcarRespuestaVerificada({ respuestaId, verificadorId: autorId, puedeVerificarComoDocente: false }))
      .rejects.toMatchObject({ code: 'DUDA_NO_ENCONTRADA', httpStatus: 404 });
  });

  test('rechaza entradas inválidas sin tocar el repositorio', async () => {
    const { repository, obtenerRespuesta } = makeRepository();
    const service = new CatalogService(repository);

    await expect(service.marcarRespuestaVerificada({ respuestaId: 'bad', verificadorId: autorId, puedeVerificarComoDocente: false }))
      .rejects.toMatchObject({ code: 'ENTRADA_INVALIDA', httpStatus: 400 });
    expect(obtenerRespuesta).not.toHaveBeenCalled();
  });
});