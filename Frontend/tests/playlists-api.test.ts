jest.mock('../src/api/http', () => ({ apiFetch: jest.fn() }));
jest.mock('../src/config/env', () => ({ config: { apiBaseUrl: 'http://api.test' } }));

import { apiFetch } from '../src/api/http';
import { reproduccionApi } from '../src/api/reproduccion';

const apiFetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>;

describe('reproduccionApi: playlists de repaso', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  test('lista las playlists y crea una nueva enviando nombre y visibilidad', async () => {
    apiFetchMock.mockResolvedValue({ playlists: [] } as never);
    await reproduccionApi.listarPlaylists('token');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/reproduccion/playlists', { token: 'token' });

    apiFetchMock.mockResolvedValue({ message: 'ok', playlist: {} } as never);
    await reproduccionApi.crearPlaylist('Repaso Parcial', true, 'token');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/reproduccion/playlists', {
      method: 'POST',
      body: { nombre: 'Repaso Parcial', esPublica: true },
      token: 'token',
    });
  });

  test('consulta el apartado de playlists públicas de la comunidad', async () => {
    apiFetchMock.mockResolvedValue({ playlists: [] } as never);
    await reproduccionApi.listarPlaylistsPublicas('token');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/reproduccion/playlists/publicas', { token: 'token' });
  });

  test('obtiene el detalle de una playlist propia y de una pública por enlace', async () => {
    apiFetchMock.mockResolvedValue({ playlist: null, items: [] } as never);

    await reproduccionApi.obtenerPlaylist('playlist/1', 'token');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/reproduccion/playlists/playlist%2F1', { token: 'token' });

    await reproduccionApi.obtenerPlaylistPublica('enlace-abc', 'token');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/reproduccion/playlists/publicas/enlace-abc', {
      token: 'token',
    });
  });

  test('actualiza y elimina una playlist usando su identificador', async () => {
    apiFetchMock.mockResolvedValue({ message: 'ok', playlist: {} } as never);
    await reproduccionApi.actualizarPlaylist('playlist-1', 'Nuevo nombre', false, 'token');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/reproduccion/playlists/playlist-1', {
      method: 'PATCH',
      body: { nombre: 'Nuevo nombre', esPublica: false },
      token: 'token',
    });

    apiFetchMock.mockResolvedValue({ message: 'ok', eliminada: true } as never);
    await reproduccionApi.eliminarPlaylist('playlist-1', 'token');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/reproduccion/playlists/playlist-1', {
      method: 'DELETE',
      token: 'token',
    });
  });

  test('agrega un elemento con su fragmento, reordena y lo elimina', async () => {
    apiFetchMock.mockResolvedValue({ message: 'ok', item: {}, cantidadItems: 3 } as never);
    await reproduccionApi.agregarItemPlaylist('playlist-1', 'clase-1', 120, 'token');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/reproduccion/playlists/playlist-1/items', {
      method: 'POST',
      body: { claseId: 'clase-1', segundoInicio: 120 },
      token: 'token',
    });

    apiFetchMock.mockResolvedValue({ message: 'ok', items: [] } as never);
    await reproduccionApi.reordenarPlaylist('playlist-1', ['b', 'a'], 'token');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/reproduccion/playlists/playlist-1/items/orden', {
      method: 'PUT',
      body: { itemsOrdenados: ['b', 'a'] },
      token: 'token',
    });

    apiFetchMock.mockResolvedValue({ message: 'ok', eliminado: true, cantidadItems: 2 } as never);
    await reproduccionApi.eliminarItemPlaylist('playlist-1', 'item/uno', 'token');
    expect(apiFetchMock).toHaveBeenLastCalledWith('/reproduccion/playlists/playlist-1/items/item%2Funo', {
      method: 'DELETE',
      token: 'token',
    });
  });
});