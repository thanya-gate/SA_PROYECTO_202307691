jest.mock('../src/config/env', () => ({ config: { apiBaseUrl: '/api', allowedDomains: [] } }));

import { ApiError } from '../src/api/http';
import { materialesApi, TAMANO_MAXIMO_MATERIAL } from '../src/api/materiales';

describe('materialesApi: carga segura', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  test('deriva MIME por extensión, sanitiza x-filename y envía token', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ material: { extension: '.py' } }),
    });
    const file = new File(['print(1)'], '../../Guía.py', { type: 'application/octet-stream' });
    await materialesApi.subir('clase/1', file, 'token');
    expect(fetchMock).toHaveBeenCalledWith('/api/catalog/classes/clase%2F1/materials', expect.objectContaining({
      method: 'POST',
      headers: {
        'Content-Type': 'text/x-python',
        'x-filename': 'Guia.py',
        Authorization: 'Bearer token',
      },
      body: file,
      credentials: 'include',
    }));
  });

  test('rechaza localmente archivos mayores a 50 MB', async () => {
    const file = { name: 'grande.pdf', size: TAMANO_MAXIMO_MATERIAL + 1, type: 'application/pdf' } as File;
    await expect(materialesApi.subir('clase', file, 'token')).rejects.toMatchObject({
      status: 413,
      code: 'ARCHIVO_MUY_GRANDE',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('traduce errores HTTP del gateway', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 415,
      text: async () => JSON.stringify({ error: { code: 'TIPO_NO_PERMITIDO', message: 'MIME no permitido' } }),
    });
    const file = new File(['data'], 'virus.exe', { type: 'application/octet-stream' });
    await expect(materialesApi.subir('clase', file, '')).rejects.toEqual(
      new ApiError(415, 'TIPO_NO_PERMITIDO', 'MIME no permitido'),
    );
  });
});
