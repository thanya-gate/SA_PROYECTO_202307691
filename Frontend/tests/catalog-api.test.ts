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

describe('catalogApi: todas las operaciones van al gateway con el token', () => {
  beforeEach(() => apiFetchMock.mockReset());

  test.each([
    ['search', () => catalogApi.search({ tema: ' redes ', page: 2, semestre: '' }, 'tk'), '/catalog/classes?tema=redes&page=2'],
    ['getClase', () => catalogApi.getClase('c1', 'tk'), '/catalog/classes/c1'],
    ['semestres', () => catalogApi.semestres('2026-2', 'tk'), '/catalog/semestres?semestre=2026-2'],
    ['semestres sin filtro', () => catalogApi.semestres('', 'tk'), '/catalog/semestres'],
    ['getCursoPorCodigo', () => catalogApi.getCursoPorCodigo('0770', 'tk'), '/catalog/courses/0770'],
    ['publicarClase', () => catalogApi.publicarClase({} as any, 'tk'), '/catalog/classes'],
    ['editarClase', () => catalogApi.editarClase('c1', {} as any, 'tk'), '/catalog/classes/c1'],
    ['actualizarDuracion', () => catalogApi.actualizarDuracion('c1', 60, 'tk'), '/catalog/classes/c1/duracion'],
    ['eliminarClase', () => catalogApi.eliminarClase('c1', 'tk'), '/catalog/classes/c1'],
    ['actualizarCapitulo', () => catalogApi.actualizarCapitulo('cap1', { titulo: 'T', inicioSegundos: 0, finSegundos: 9 } as any, 'tk'), 'cap1'],
    ['eliminarCapitulo', () => catalogApi.eliminarCapitulo('cap1', 'tk'), 'cap1'],
    ['listarDudas', () => catalogApi.listarDudas('c1', 'tk'), '/catalog/classes/c1/dudas'],
    ['crearDuda', () => (catalogApi.crearDuda as any)('c1', { pregunta: '¿?', posicionSegundos: 1 }, 'tk'), '/catalog/classes/c1/dudas'],
    ['responderDuda', () => (catalogApi.responderDuda as any)('d1', { contenido: 'sí' }, 'tk'), 'd1'],
    ['marcarRespuestaVerificada', () => catalogApi.marcarRespuestaVerificada('r1', 'tk'), 'r1'],
  ])('%s', async (_nombre, llamar, ruta) => {
    apiFetchMock.mockResolvedValue({} as never);
    await llamar();
    const [path, opciones] = apiFetchMock.mock.calls[0] as [string, { token?: string }];
    expect(path).toContain(ruta);
    expect(opciones.token).toBe('tk');
  });
});
