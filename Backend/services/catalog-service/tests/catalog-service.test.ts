import { CatalogService } from '../src/application/services/catalog.service';
import {
  actualizarCapituloSchema,
  crearCapituloSchema,
  registrarMaterialSchema,
} from '../src/application/dto/catalog-schemas';
import type { CatalogRepository } from '../src/application/ports/catalog-repository';

const claseId = '11111111-1111-4111-8111-111111111111';
const capituloId = '22222222-2222-4222-8222-222222222222';
const otroId = '33333333-3333-4333-8333-333333333333';

function capitulo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    capituloId,
    claseId,
    titulo: 'Introducción',
    inicioSegundos: 0,
    finSegundos: 60,
    orden: 1,
    fechaCreacion: '2026-08-25T00:00:00.000Z',
    fechaActualizacion: '2026-08-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('DTO de capítulos y materiales', () => {
  test('acepta el rango completo desde cero y orden automático', () => {
    expect(crearCapituloSchema.parse({
      claseId,
      titulo: '  Clase completa  ',
      inicioSegundos: 0,
      finSegundos: 3600,
    })).toEqual({
      claseId,
      titulo: 'Clase completa',
      inicioSegundos: 0,
      finSegundos: 3600,
      orden: 0,
    });
  });

  test.each([
    ['UUID inválido', { claseId: 'no-uuid' }],
    ['título vacío', { titulo: '   ' }],
    ['título largo', { titulo: 'x'.repeat(201) }],
    ['inicio negativo', { inicioSegundos: -1 }],
    ['inicio decimal', { inicioSegundos: 1.5 }],
    ['inicio NaN', { inicioSegundos: Number.NaN }],
    ['inicio infinito', { inicioSegundos: Number.POSITIVE_INFINITY }],
    ['fin igual al inicio', { inicioSegundos: 10, finSegundos: 10 }],
    ['fin anterior al inicio', { inicioSegundos: 20, finSegundos: 10 }],
    ['orden negativo', { orden: -1 }],
  ])('rechaza %s antes de invocar el repositorio', (_caso, overrides) => {
    const result = crearCapituloSchema.safeParse({
      claseId,
      titulo: 'Tema',
      inicioSegundos: 0,
      finSegundos: 60,
      ...overrides,
    });
    expect(result.success).toBe(false);
  });

  test('valida que una actualización también requiera ambos UUID', () => {
    expect(actualizarCapituloSchema.safeParse({
      capituloId,
      claseId: otroId,
      titulo: 'Tema',
      inicioSegundos: 0,
      finSegundos: 60,
    }).success).toBe(true);
    expect(actualizarCapituloSchema.safeParse({
      capituloId: 'bad',
      claseId,
      titulo: 'Tema',
      inicioSegundos: 0,
      finSegundos: 60,
    }).success).toBe(false);
  });

  test('rechaza metadata de material con tamaño negativo, extensión inválida o UUID inválido', () => {
    const base = {
      claseId,
      nombreArchivo: 'guia.pdf',
      mimeType: 'application/pdf',
      extension: '.pdf',
      tamanoBytes: 10,
      urlArchivo: '/media/guia.pdf',
    };
    expect(registrarMaterialSchema.safeParse({ ...base, tamanoBytes: -1 }).success).toBe(false);
    expect(registrarMaterialSchema.safeParse({ ...base, extension: 'pdf' }).success).toBe(false);
    expect(registrarMaterialSchema.safeParse({ ...base, materialId: 'bad' }).success).toBe(false);
  });
});

describe('CatalogService: capítulos y materiales', () => {
  function makeRepository() {
    const crearCapitulo = jest.fn().mockResolvedValue(capitulo());
    const actualizarCapitulo = jest.fn().mockResolvedValue(capitulo({ titulo: 'Actualizado', inicioSegundos: 30, finSegundos: 90, orden: 2 }));
    const eliminarCapitulo = jest.fn().mockResolvedValue({ eliminado: true, claseId });
    const registrarMaterial = jest.fn();
    const repository = { crearCapitulo, actualizarCapitulo, eliminarCapitulo, registrarMaterial } as unknown as CatalogRepository;
    return { repository, crearCapitulo, actualizarCapitulo, eliminarCapitulo, registrarMaterial };
  }

  test('crea un capítulo y conserva el orden 0 como señal de asignación automática', async () => {
    const { repository, crearCapitulo } = makeRepository();
    const service = new CatalogService(repository);

    await expect(service.crearCapitulo({ claseId, titulo: 'Tema', inicioSegundos: 0, finSegundos: 3600 }))
      .resolves.toMatchObject({ capituloId });
    expect(crearCapitulo).toHaveBeenCalledWith({
      claseId,
      titulo: 'Tema',
      inicioSegundos: 0,
      finSegundos: 3600,
      orden: 0,
    });
  });

  test('no llama al repositorio para entradas inválidas', async () => {
    const { repository, crearCapitulo } = makeRepository();
    const service = new CatalogService(repository);

    await expect(service.crearCapitulo({
      claseId: 'bad',
      titulo: 'Tema',
      inicioSegundos: 0,
      finSegundos: 60,
    })).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA', httpStatus: 400 });
    expect(crearCapitulo).not.toHaveBeenCalled();
  });

  test.each([
    ['CLASE_NO_ENCONTRADA: la clase no existe', 'CLASE_NO_ENCONTRADA', 404],
    ['CONFLICTO: rango superpuesto', 'CONFLICTO', 409],
    ['ENTRADA_INVALIDA: duración insuficiente', 'ENTRADA_INVALIDA', 400],
  ])('traduce errores SQL de creación: %s', async (mensaje, code, httpStatus) => {
    const { repository, crearCapitulo } = makeRepository();
    crearCapitulo.mockRejectedValue(new Error(mensaje));
    const service = new CatalogService(repository);

    await expect(service.crearCapitulo({ claseId, titulo: 'Tema', inicioSegundos: 0, finSegundos: 60 }))
      .rejects.toMatchObject({ code, httpStatus });
  });

  test('actualiza título, rango y orden, y permite conservar su propio rango', async () => {
    const { repository, actualizarCapitulo } = makeRepository();
    const service = new CatalogService(repository);
    const input = { capituloId, claseId, titulo: 'Actualizado', inicioSegundos: 0, finSegundos: 60, orden: 1 };

    await expect(service.actualizarCapitulo(input)).resolves.toMatchObject({ titulo: 'Actualizado' });
    expect(actualizarCapitulo).toHaveBeenCalledWith(input);
  });

  test('mapea capítulo inexistente y error de clase distinta', async () => {
    const { repository, actualizarCapitulo } = makeRepository();
    actualizarCapitulo.mockResolvedValueOnce(null);
    const service = new CatalogService(repository);
    await expect(service.actualizarCapitulo({ capituloId, claseId, titulo: 'T', inicioSegundos: 0, finSegundos: 60 }))
      .rejects.toMatchObject({ code: 'CAPITULO_NO_ENCONTRADO', httpStatus: 404 });

    actualizarCapitulo.mockRejectedValueOnce(new Error('ENTRADA_INVALIDA: el capítulo no pertenece a la clase indicada'));
    await expect(service.actualizarCapitulo({ capituloId, claseId: otroId, titulo: 'T', inicioSegundos: 0, finSegundos: 60 }))
      .rejects.toMatchObject({ code: 'ENTRADA_INVALIDA', httpStatus: 400 });
  });

  test('elimina y devuelve la clase asociada, o informa 404', async () => {
    const { repository, eliminarCapitulo } = makeRepository();
    const service = new CatalogService(repository);
    await expect(service.eliminarCapitulo(capituloId)).resolves.toEqual({ eliminado: true, claseId });

    eliminarCapitulo.mockResolvedValueOnce({ eliminado: false, claseId: null });
    await expect(service.eliminarCapitulo(capituloId)).rejects.toMatchObject({
      code: 'CAPITULO_NO_ENCONTRADO',
      httpStatus: 404,
    });
    await expect(service.eliminarCapitulo('')).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA', httpStatus: 400 });
  });

  test('registra y lista material con validación de entrada', async () => {
    const material = {
      materialId: capituloId,
      claseId,
      nombreArchivo: 'guia.pdf',
      mimeType: 'application/pdf',
      extension: '.pdf',
      tamanoBytes: 50,
      versionActual: 1,
      totalDescargas: 0,
      subidoPor: null,
      fechaSubida: '2026-08-25T00:00:00.000Z',
      urlArchivo: '/media/guia.pdf',
    };
    const { repository, registrarMaterial } = makeRepository();
    registrarMaterial.mockResolvedValue(material);
    const service = new CatalogService(repository);
    await expect(service.registrarMaterial({
      claseId,
      nombreArchivo: 'guia.pdf',
      mimeType: 'application/pdf',
      extension: '.pdf',
      tamanoBytes: 50,
      urlArchivo: '/media/guia.pdf',
    })).resolves.toEqual(material);
    expect(registrarMaterial).toHaveBeenCalled();
    await expect(service.registrarMaterial({
      claseId: 'bad',
      nombreArchivo: 'guia.pdf',
      mimeType: 'application/pdf',
      extension: '.pdf',
      urlArchivo: '/media/guia.pdf',
    })).rejects.toMatchObject({ code: 'ENTRADA_INVALIDA', httpStatus: 400 });
  });
});
