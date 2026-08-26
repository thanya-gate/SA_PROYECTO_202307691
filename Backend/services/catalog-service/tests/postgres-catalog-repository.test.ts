jest.mock('../src/infrastructure/persistence/postgres/db', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));

import { query } from '../src/infrastructure/persistence/postgres/db';
import { PostgresCatalogRepository } from '../src/infrastructure/persistence/postgres/postgres-catalog-repository';

const queryMock = query as jest.MockedFunction<typeof query>;
const claseId = '11111111-1111-4111-8111-111111111111';
const capituloId = '22222222-2222-4222-8222-222222222222';

const rows = (value: unknown[]) => ({ rows: value, rowCount: value.length });

describe('PostgresCatalogRepository: capítulos y materiales', () => {
  beforeEach(() => queryMock.mockReset());

  test('lista capítulos con el orden estable definido por SQL y mapea fechas/números', async () => {
    queryMock.mockResolvedValue(rows([
      {
        capitulo_id: capituloId,
        clase_id: claseId,
        titulo: 'Tema',
        inicio_segundos: '30',
        fin_segundos: '60',
        orden: '2',
        fecha_creacion: '2026-08-25T00:00:00.000Z',
        fecha_actualizacion: '2026-08-25T00:00:01.000Z',
      },
    ]) as never);
    const repository = new PostgresCatalogRepository();

    await expect(repository.listarCapitulos(claseId)).resolves.toEqual([{
      capituloId,
      claseId,
      titulo: 'Tema',
      inicioSegundos: 30,
      finSegundos: 60,
      orden: 2,
      fechaCreacion: '2026-08-25T00:00:00.000Z',
      fechaActualizacion: '2026-08-25T00:00:01.000Z',
    }]);
    expect(queryMock.mock.calls[0][0]).toContain('ORDER BY orden, inicio_segundos, capitulo_id');
    expect(queryMock.mock.calls[0][1]).toEqual([claseId]);
  });

  test('crea un capítulo usando NULL para asignar automáticamente el orden', async () => {
    queryMock
      .mockResolvedValueOnce(rows([{ p_capitulo_id: capituloId }]) as never)
      .mockResolvedValueOnce(rows([{
        capitulo_id: capituloId,
        clase_id: claseId,
        titulo: 'Completo',
        inicio_segundos: 0,
        fin_segundos: 3600,
        orden: 1,
        fecha_creacion: '2026-08-25T00:00:00.000Z',
        fecha_actualizacion: '2026-08-25T00:00:00.000Z',
      }]) as never);
    const repository = new PostgresCatalogRepository();

    await repository.crearCapitulo({ claseId, titulo: 'Completo', inicioSegundos: 0, finSegundos: 3600, orden: 0 });
    expect(queryMock.mock.calls[0]).toEqual([
      'CALL sp_crear_capitulo($1, $2, $3, $4, $5, NULL)',
      [claseId, 'Completo', 0, 3600, null],
    ]);
    expect(queryMock.mock.calls[1][1]).toEqual([capituloId]);
  });

  test('actualiza un capítulo y conserva el orden existente cuando llega 0', async () => {
    queryMock
      .mockResolvedValueOnce(rows([{ p_actualizado: true }]) as never)
      .mockResolvedValueOnce(rows([{
        capitulo_id: capituloId,
        clase_id: claseId,
        titulo: 'Editado',
        inicio_segundos: 30,
        fin_segundos: 90,
        orden: 2,
        fecha_creacion: '2026-08-25T00:00:00.000Z',
        fecha_actualizacion: '2026-08-25T00:01:00.000Z',
      }]) as never);
    const repository = new PostgresCatalogRepository();

    await expect(repository.actualizarCapitulo({
      capituloId,
      claseId,
      titulo: 'Editado',
      inicioSegundos: 30,
      finSegundos: 90,
      orden: 0,
    })).resolves.toMatchObject({ titulo: 'Editado', orden: 2 });
    expect(queryMock.mock.calls[0][1]).toEqual([capituloId, claseId, 'Editado', 30, 90, null]);
  });

  test('devuelve claseId al eliminar y maneja ausencia', async () => {
    queryMock.mockResolvedValueOnce(rows([{ p_eliminado: true, p_clase_id: claseId }]) as never);
    const repository = new PostgresCatalogRepository();
    await expect(repository.eliminarCapitulo(capituloId)).resolves.toEqual({ eliminado: true, claseId });

    queryMock.mockResolvedValueOnce(rows([{ p_eliminado: false, p_clase_id: null }]) as never);
    await expect(repository.eliminarCapitulo(capituloId)).resolves.toEqual({ eliminado: false, claseId: null });
  });

  test('mapea metadata de material, versiones y descargas', async () => {
    queryMock.mockResolvedValueOnce(rows([{
      material_id: capituloId,
      clase_id: claseId,
      nombre_archivo: 'guia.pdf',
      mime_type: 'application/pdf',
      extension: '.pdf',
      tamano_bytes: '50',
      version_actual: '2',
      total_descargas: '3',
      subido_por: null,
      fecha_subida: '2026-08-25T00:00:00.000Z',
      url_archivo: '/media/guia-v2.pdf',
    }]) as never);
    const repository = new PostgresCatalogRepository();
    await expect(repository.obtenerMaterial(capituloId)).resolves.toMatchObject({
      materialId: capituloId,
      tamanoBytes: 50,
      versionActual: 2,
      totalDescargas: 3,
    });

    queryMock.mockResolvedValueOnce(rows([{ p_numero_version: 2 }]) as never)
      .mockResolvedValueOnce(rows([{
        material_id: capituloId,
        clase_id: claseId,
        nombre_archivo: 'guia.pdf',
        mime_type: 'application/pdf',
        extension: '.pdf',
        tamano_bytes: 60,
        version_actual: 2,
        total_descargas: 3,
        subido_por: null,
        fecha_subida: '2026-08-25T00:00:00.000Z',
        url_archivo: '/media/guia-v2.pdf',
      }]) as never);
    await expect(repository.agregarVersionMaterial({ materialId: capituloId, tamanoBytes: 60, urlArchivo: '/media/guia-v2.pdf' }))
      .resolves.toMatchObject({ versionActual: 2 });

    queryMock.mockResolvedValueOnce(rows([{ p_total_descargas: '4' }]) as never);
    await expect(repository.registrarDescargaMaterial(capituloId)).resolves.toBe(4);
  });
});
