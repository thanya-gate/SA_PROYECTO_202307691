jest.mock('../src/api/http', () => ({ apiFetch: jest.fn() }));
jest.mock('../src/config/env', () => ({ config: { apiBaseUrl: 'http://api.test' } }));

import { apiFetch } from '../src/api/http';
import { reproduccionApi } from '../src/api/reproduccion';

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;
const originalFetch = globalThis.fetch;

describe('reproduccionApi: cuaderno de apuntes', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    globalThis.fetch = jest.fn();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  test('lista todos los apuntes o filtra por una clase codificada', async () => {
    apiFetchMock.mockResolvedValue({ apuntes: [] } as never);

    await reproduccionApi.listarApuntes('token');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/reproduccion/apuntes', { token: 'token' });

    await reproduccionApi.listarApuntes('token', 'clase/uno');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/reproduccion/apuntes?claseId=clase%2Funo', { token: 'token' });
  });

  test('crea sin apunteId y actualiza incluyéndolo en el cuerpo', async () => {
    apiFetchMock.mockResolvedValue({ message: 'ok', apunte: {} } as never);

    await reproduccionApi.guardarApunte('clase-1', '', 'Título', 'Contenido', 30, 'token');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/reproduccion/apuntes', {
      method: 'POST',
      body: {
        claseId: 'clase-1',
        titulo: 'Título',
        contenidoMarkdown: 'Contenido',
        posicionSegundos: 30,
      },
      token: 'token',
    });

    await reproduccionApi.guardarApunte('clase-1', 'apunte-1', 'Editado', '[00:30] texto', 30, 'token');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/reproduccion/apuntes', {
      method: 'POST',
      body: {
        claseId: 'clase-1',
        apunteId: 'apunte-1',
        titulo: 'Editado',
        contenidoMarkdown: '[00:30] texto',
        posicionSegundos: 30,
      },
      token: 'token',
    });
  });

  test('elimina usando un identificador codificado', async () => {
    apiFetchMock.mockResolvedValue({ message: 'ok', eliminado: true } as never);
    await reproduccionApi.eliminarApunte('apunte/uno', 'token');
    expect(apiFetchMock).toHaveBeenCalledWith('/reproduccion/apuntes/apunte%2Funo', {
      method: 'DELETE',
      token: 'token',
    });
  });

  test('descarga el Markdown autenticado y obtiene metadata de los encabezados', async () => {
    const headers = {
      get: jest.fn((name: string) => ({
        'Content-Disposition': 'attachment; filename="cuaderno.md"',
        'Content-Type': 'text/markdown; charset=utf-8',
      })[name] ?? null),
    };
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers,
      text: jest.fn().mockResolvedValue('# Cuaderno'),
    });

    await expect(reproduccionApi.exportarApunteMd('clase/uno', 'token')).resolves.toEqual({
      nombreArchivo: 'cuaderno.md',
      contenidoMd: '# Cuaderno',
      mimeType: 'text/markdown; charset=utf-8',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith('http://api.test/reproduccion/apuntes/clase%2Funo/exportar', {
      headers: { Authorization: 'Bearer token' },
      credentials: 'include',
    });
  });

  test('usa metadata de respaldo y rechaza respuestas HTTP fallidas', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: jest.fn(() => null) },
      text: jest.fn().mockResolvedValue('contenido'),
    });
    await expect(reproduccionApi.exportarApunteMd('clase-1', 'token')).resolves.toEqual({
      nombreArchivo: 'apuntes-clase-1.md',
      contenidoMd: 'contenido',
      mimeType: 'text/markdown',
    });

    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 503 });
    await expect(reproduccionApi.exportarApunteMd('clase-1', 'token')).rejects.toThrow('HTTP 503');
  });
});
