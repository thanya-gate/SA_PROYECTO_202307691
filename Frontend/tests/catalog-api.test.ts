jest.mock('../src/api/http', () => ({ apiFetch: jest.fn() }));

import { apiFetch } from '../src/api/http';
import { catalogApi } from '../src/api/catalog';

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe('catalogApi: capítulos', () => {
  beforeEach(() => apiFetchMock.mockReset());

  test('construye rutas, encodea ids y envía token/cuerpo', async () => {
    apiFetchMock.mockResolvedValue({ capitulos: [] } as never);
    await catalogApi.listarCapitulos('clase/1', 'token');
    expect(apiFetchMock).toHaveBeenCalledWith('/catalog/classes/clase%2F1/chapters', { token: 'token' });

    apiFetchMock.mockResolvedValue({ capitulo: { capituloId: '1' } } as never);
    await catalogApi.crearCapitulo('clase-1', { titulo: 'Tema', inicioSegundos: 0, finSegundos: 10 }, 'token');
    expect(apiFetchMock).toHaveBeenCalledWith('/catalog/classes/clase-1/chapters', {
      method: 'POST',
      body: { titulo: 'Tema', inicioSegundos: 0, finSegundos: 10 },
      token: 'token',
    });
  });
});
