import request from 'supertest';
import { createGateway } from '../src/server';

const playlist = {
  playlistId: 'playlist-1',
  estudianteId: 'estudiante-1',
  nombre: 'Repaso del segundo parcial',
  esPublica: false,
  enlacePublico: '',
  cantidadItems: 0,
  fechaCreacion: '2026-09-10T10:00:00.000Z',
  fechaActualizacion: '2026-09-10T10:00:00.000Z',
};

const item = {
  playlistItemId: 'item-1',
  claseId: 'clase-1',
  orden: 0,
  segundoInicio: 0,
  fechaAgregado: '2026-09-10T10:05:00.000Z',
};

function makeHarness() {
  const auth = {
    validateSession: jest.fn(async (token: string) => ({
      session: {
        sessionId: `session-${token}`,
        userId: 'estudiante-1',
        email: 'estudiante@ingenieria.usac.edu.gt',
        roles: token === 'student' ? ['ROLE_ESTUDIANTE'] : token === 'teacher' ? ['ROLE_CATEDRATICO'] : [token],
      },
    })),
  };
  const reproduction = {
    listarPlaylists: jest.fn().mockResolvedValue({ playlists: [playlist] }),
    listarPlaylistsPublicas: jest
      .fn()
      .mockResolvedValue({
        playlists: [{ ...playlist, esPublica: true, enlacePublico: 'enlace-abc', clasePortada: 'clase-1' }],
      }),
    crearPlaylist: jest.fn().mockResolvedValue({ playlist: { ...playlist, esPublica: true } }),
    obtenerPlaylist: jest.fn().mockResolvedValue({ playlist, items: [item] }),
    obtenerPlaylistPublica: jest
      .fn()
      .mockResolvedValue({ playlist: { ...playlist, esPublica: true, enlacePublico: 'enlace-abc' }, items: [item] }),
    actualizarPlaylist: jest.fn().mockResolvedValue({ playlist }),
    eliminarPlaylist: jest.fn().mockResolvedValue({ eliminada: true }),
    agregarItemPlaylist: jest.fn().mockResolvedValue({ item, cantidadItems: 1 }),
    reordenarPlaylist: jest.fn().mockResolvedValue({ items: [item] }),
    eliminarItemPlaylist: jest.fn().mockResolvedValue({ eliminado: true, cantidadItems: 0 }),
  };
  const catalog = {
    getClase: jest.fn().mockResolvedValue({
      clase: {
        claseId: 'clase-1',
        codigo: 'SA-003',
        curso: 'Software Avanzado',
        escuela: 'Ingeniería',
        unidad: 'Unidad 2',
        tema: 'Arquitectura',
        semestre: '2S',
        anio: 2026,
        urlVideo: 'https://www.youtube.com/watch?v=abc123',
      },
    }),
  };
  const app = createGateway({
    authGrpc: auth as any,
    reproductionGrpc: reproduction as any,
    catalogGrpc: catalog as any,
  });
  return { app, auth, reproduction, catalog };
}

describe('gateway: playlists de repaso', () => {
  test('exige sesión y niega acceso a roles no permitidos', async () => {
    const noSession = makeHarness();
    await request(noSession.app).get('/reproduccion/playlists').expect(401);
    expect(noSession.reproduction.listarPlaylists).not.toHaveBeenCalled();

    const teacher = makeHarness();
    await request(teacher.app)
      .get('/reproduccion/playlists')
      .set('Authorization', 'Bearer teacher')
      .expect(403);
    expect(teacher.reproduction.listarPlaylists).not.toHaveBeenCalled();
  });

  test('lista las playlists del estudiante autenticado', async () => {
    const harness = makeHarness();
    const response = await request(harness.app)
      .get('/reproduccion/playlists')
      .set('Authorization', 'Bearer student')
      .expect(200);

    expect(harness.reproduction.listarPlaylists).toHaveBeenCalledWith({ estudianteId: 'estudiante-1' });
    expect(response.body).toEqual({ playlists: [playlist] });
  });

  test('crea, actualiza y elimina una playlist', async () => {
    const harness = makeHarness();

    await request(harness.app)
      .post('/reproduccion/playlists')
      .set('Authorization', 'Bearer student')
      .send({ estudianteId: 'otro', nombre: '  Repaso  ', esPublica: true })
      .expect(201);
    expect(harness.reproduction.crearPlaylist).toHaveBeenCalledWith({
      estudianteId: 'estudiante-1',
      nombre: 'Repaso',
      esPublica: true,
    });

    await request(harness.app)
      .patch('/reproduccion/playlists/playlist-1')
      .set('Authorization', 'Bearer student')
      .send({ nombre: 'Editado', esPublica: false })
      .expect(200);
    expect(harness.reproduction.actualizarPlaylist).toHaveBeenCalledWith({
      estudianteId: 'estudiante-1',
      playlistId: 'playlist-1',
      nombre: 'Editado',
      esPublica: false,
    });

    await request(harness.app)
      .delete('/reproduccion/playlists/playlist-1')
      .set('Authorization', 'Bearer student')
      .expect(200);
    expect(harness.reproduction.eliminarPlaylist).toHaveBeenCalledWith({
      estudianteId: 'estudiante-1',
      playlistId: 'playlist-1',
    });
  });

  test('obtiene el detalle enriqueciendo los elementos con el catálogo', async () => {
    const harness = makeHarness();
    const response = await request(harness.app)
      .get('/reproduccion/playlists/playlist-1')
      .set('Authorization', 'Bearer student')
      .expect(200);

    expect(response.body.playlist.playlistId).toBe('playlist-1');
    expect(response.body.items[0]).toEqual(
      expect.objectContaining({
        playlistItemId: 'item-1',
        claseId: 'clase-1',
        codigo: 'SA-003',
        curso: 'Software Avanzado',
        tema: 'Arquitectura',
        semestre: '2S',
      }),
    );
    expect(harness.catalog.getClase).toHaveBeenCalledWith('clase-1');
  });

  test('expone el detalle público por enlace a cualquier rol autenticado', async () => {
    const harness = makeHarness();
    const response = await request(harness.app)
      .get('/reproduccion/playlists/publicas/enlace-abc')
      .set('Authorization', 'Bearer teacher')
      .expect(200);

    expect(harness.reproduction.obtenerPlaylistPublica).toHaveBeenCalledWith({ enlacePublico: 'enlace-abc' });
    expect(response.body.playlist.esPublica).toBe(true);
    expect(response.body.items[0].curso).toBe('Software Avanzado');
  });

  test('lista las playlists públicas de otros estudiantes en el apartado', async () => {
    const harness = makeHarness();
    const response = await request(harness.app)
      .get('/reproduccion/playlists/publicas')
      .set('Authorization', 'Bearer student')
      .expect(200);

    expect(harness.reproduction.listarPlaylistsPublicas).toHaveBeenCalledWith({ estudianteId: 'estudiante-1' });
    expect(harness.catalog.getClase).toHaveBeenCalledWith('clase-1');
    expect(response.body.playlists).toHaveLength(1);
    expect(response.body.playlists[0]).toEqual(
      expect.objectContaining({
        playlistId: 'playlist-1',
        enlacePublico: 'enlace-abc',
        esPublica: true,
        clasePortada: 'clase-1',
        urlVideo: 'https://www.youtube.com/watch?v=abc123',
        curso: 'Software Avanzado',
      }),
    );
  });

  test('agrega, reordena y retira elementos normalizando la posición', async () => {
    const harness = makeHarness();

    await request(harness.app)
      .post('/reproduccion/playlists/playlist-1/items')
      .set('Authorization', 'Bearer student')
      .send({ claseId: 'clase-1', segundoInicio: -30 })
      .expect(201);
    expect(harness.reproduction.agregarItemPlaylist).toHaveBeenCalledWith({
      estudianteId: 'estudiante-1',
      playlistId: 'playlist-1',
      claseId: 'clase-1',
      segundoInicio: 0,
    });

    await request(harness.app)
      .put('/reproduccion/playlists/playlist-1/items/orden')
      .set('Authorization', 'Bearer student')
      .send({ itemsOrdenados: ['item-1'] })
      .expect(200);
    expect(harness.reproduction.reordenarPlaylist).toHaveBeenCalledWith({
      estudianteId: 'estudiante-1',
      playlistId: 'playlist-1',
      itemsOrdenados: ['item-1'],
    });

    await request(harness.app)
      .delete('/reproduccion/playlists/playlist-1/items/item-1')
      .set('Authorization', 'Bearer student')
      .expect(200);
    expect(harness.reproduction.eliminarItemPlaylist).toHaveBeenCalledWith({
      estudianteId: 'estudiante-1',
      playlistId: 'playlist-1',
      playlistItemId: 'item-1',
    });
  });

  test.each([
    { metodo: 'post', url: '/reproduccion/playlists', body: {}, caso: 'crear sin nombre' },
    { metodo: 'post', url: '/reproduccion/playlists/playlist-1/items', body: {}, caso: 'agregar sin claseId' },
    { metodo: 'put', url: '/reproduccion/playlists/playlist-1/items/orden', body: { itemsOrdenados: [] }, caso: 'reordenar con lista vacía' },
  ])('rechaza $caso antes de invocar gRPC', async ({ metodo, url, body }) => {
    const harness = makeHarness();
    const requestBuilder = request(harness.app)[metodo as 'post' | 'put'](url);
    await requestBuilder
      .set('Authorization', 'Bearer student')
      .send(body)
      .expect(400);
    expect(harness.reproduction.crearPlaylist).not.toHaveBeenCalled();
    expect(harness.reproduction.agregarItemPlaylist).not.toHaveBeenCalled();
    expect(harness.reproduction.reordenarPlaylist).not.toHaveBeenCalled();
  });
});