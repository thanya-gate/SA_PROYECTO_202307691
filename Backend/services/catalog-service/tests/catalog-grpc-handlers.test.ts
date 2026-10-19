import path from 'path';
import * as grpc from '@grpc/grpc-js';
import { createGrpcServer } from '../src/interfaces/grpc/server';
import { DomainError } from '../src/domain/errors/domain-error';

// Prueba el adaptador gRPC completo sin red: se capturan los handlers que el
// servidor registra y se invocan con un servicio de catálogo simulado.

const material = {
  materialId: 'm1', claseId: 'c1', nombreArchivo: 'lab.pdf', mimeType: 'application/pdf', extension: 'pdf',
  tamanoBytes: 10, versionActual: 1, totalDescargas: 0, fechaSubida: '2026-10-01',
};
const capitulo = {
  capituloId: 'cap1', claseId: 'c1', titulo: 'Intro', inicioSegundos: 0, finSegundos: 60, orden: 1,
  fechaCreacion: '2026-10-01', fechaActualizacion: '2026-10-01',
};
const respuesta = { respuestaId: 'r1', dudaId: 'd1', autorId: 'u1', contenido: 'Sí', esVerificada: false, fechaCreacion: '2026-10-01' };
const duda = {
  dudaId: 'd1', claseId: 'c1', autorId: 'u1', posicionSegundos: 30, pregunta: '¿Por qué?', resuelta: false,
  fechaCreacion: '2026-10-01', totalRespuestas: 1, totalVerificadas: 0, respuestas: [respuesta],
};
const resumen = { claseId: 'c1', codigo: '0770', curso: 'Redes', semestre: '2S', anio: 2026, urlVideo: '/media/c1.mp4' };
const detalle = {
  ...resumen, escuela: 'Sistemas', duracion: 60, fechaPublicacion: '2026-10-01', cursoId: 'k1',
  participantes: [{ nombre: 'Ing. X', rol: 'CATEDRATICO' }], etiquetas: ['redes'], materiales: [material], capitulos: [capitulo],
};
const curso = { cursoId: 'k1', codigo: '0770', nombre: 'Redes', escuela: 'Sistemas' };

const respuestas: Record<string, unknown> = {
  search: { resultados: [resumen], total: 1, page: 1, pageSize: 10, totalPages: 1 },
  getClase: detalle,
  listarPorSemestre: [{ semestre: '2S', anio: 2026, escuela: 'Sistemas', totalClases: 3 }],
  publicarClase: { claseId: 'c1', fechaPublicacion: '2026-10-01' },
  actualizarUrlVideo: detalle,
  actualizarUrlMaterial: detalle,
  actualizarDuracion: detalle,
  actualizarClase: detalle,
  eliminarClase: undefined,
  registrarCurso: curso,
  obtenerCursoPorCodigo: curso,
  cargarClasesCSV: { registradas: 2, omitidas: 0 },
  listarSemestres: [{ semestreId: 's1', nombre: '2S', anio: 2026, clases: 3 }],
  registrarSemestre: { semestreId: 's1' },
  actualizarSemestre: undefined,
  eliminarSemestre: undefined,
  listarEscuelas: [{ escuelaId: 'e1', nombre: 'Sistemas', cursos: 4 }],
  registrarEscuela: { escuelaId: 'e1' },
  actualizarEscuela: undefined,
  eliminarEscuela: undefined,
  listarCursos: [curso],
  actualizarCurso: undefined,
  eliminarCurso: undefined,
  registrarMaterial: material,
  obtenerMaterial: material,
  agregarVersionMaterial: material,
  listarMateriales: [material],
  eliminarMaterial: undefined,
  registrarDescargaMaterial: 5,
  listarCapitulos: [capitulo],
  crearCapitulo: capitulo,
  actualizarCapitulo: capitulo,
  eliminarCapitulo: { claseId: 'c1' },
  crearDuda: duda,
  listarDudas: [duda],
  responderDuda: respuesta,
  marcarRespuestaVerificada: duda,
};

const request = {
  page: 2, pageSize: 5, semestre: '2S', claseId: 'c1', cursoId: 'k1', anio: 2026, urlVideo: 'u', duracion: 60,
  participantes: [{ nombre: 'Ing. X', rol: 'CATEDRATICO' }], etiquetas: ['redes'], codigo: '0770', nombre: 'Redes',
  clases: [{ codigoCurso: '0770', semestre: '2S', anio: 2026, urlVideo: 'u', duracion: 60 }], materialId: 'm1',
  tamanoBytes: '10', capituloId: 'cap1', titulo: 'Intro', inicioSegundos: 0, finSegundos: 60, orden: 1,
  dudaId: 'd1', autorId: 'u1', pregunta: '¿?', posicionSegundos: '30', contenido: 'Sí', respuestaId: 'r1',
  verificadorId: 'u2', puedeVerificarComoDocente: true, semestreId: 's1', escuelaId: 'e1',
};

function capturarHandlers(catalogService: any) {
  let handlers: Record<string, Function> = {};
  const spy = jest.spyOn(grpc.Server.prototype, 'addService').mockImplementation((_svc, impl) => {
    handlers = impl as any;
  });
  // El proto vive en Backend/proto, igual que en la imagen Docker (WORKDIR con ./proto).
  const cwd = jest.spyOn(process, 'cwd').mockReturnValue(path.resolve(__dirname, '../../..'));
  createGrpcServer({ catalogService, notificacionesClient: { notificarNuevaClase: jest.fn() } as any });
  spy.mockRestore();
  cwd.mockRestore();
  return handlers;
}

function invocar(handler: Function): Promise<{ err: any; res: any }> {
  return new Promise((resolve) => handler({ request }, (err: any, res: any) => resolve({ err, res })));
}

const metodos = Object.keys(respuestas);

describe('handlers gRPC del catálogo', () => {
  const ok = Object.fromEntries(metodos.map((m) => [m, jest.fn().mockResolvedValue(respuestas[m])]));
  const handlers = capturarHandlers(ok);
  const rpcs = Object.keys(handlers).filter((n) => n !== 'Health');

  it('registra un handler por cada caso de uso del servicio', () => {
    expect(rpcs).toHaveLength(metodos.length);
  });

  it.each(rpcs)('%s responde sin error y traduce al proto', async (rpc) => {
    const { err, res } = await invocar(handlers[rpc]);
    expect(err).toBeNull();
    expect(res).toBeDefined();
  });

  it('Health informa SERVING', async () => {
    expect((await invocar(handlers.Health)).res.status).toBe('SERVING');
  });

  it('mapea capítulos, materiales y participantes en GetClase', async () => {
    const { res } = await invocar(handlers.GetClase);
    expect(res.clase).toMatchObject({ claseId: 'c1', unidad: '', urlMaterial: '', participantes: [{ rol: 'CATEDRATICO' }] });
    expect(res.clase.materiales[0]).toMatchObject({ subidoPor: '', urlArchivo: '' });
    expect(res.clase.capitulos[0].titulo).toBe('Intro');
  });

  it('Search no envía paginación inválida', async () => {
    const handlersSinPagina = capturarHandlers(ok);
    await new Promise((r) => handlersSinPagina.Search({ request: { page: 0, pageSize: 0 } }, r));
    expect(ok.search).toHaveBeenLastCalledWith(expect.objectContaining({ page: undefined, pageSize: undefined }));
  });
});

describe('errores de dominio en handlers gRPC', () => {
  const falla = Object.fromEntries(
    metodos.map((m) => [m, jest.fn().mockRejectedValue(new DomainError('CLASE_NO_ENCONTRADA', 'no existe', 404))]),
  );
  const handlers = capturarHandlers(falla);
  const rpcs = Object.keys(handlers).filter((n) => n !== 'Health');

  it.each(rpcs)('%s devuelve NOT_FOUND', async (rpc) => {
    const { err } = await invocar(handlers[rpc]);
    expect(err.code).toBe(grpc.status.NOT_FOUND);
  });

  it('un error desconocido se traduce a INTERNAL', async () => {
    const h = capturarHandlers({ ...falla, search: jest.fn().mockRejectedValue(new Error('boom')) });
    expect((await invocar(h.Search)).err.code).toBe(grpc.status.INTERNAL);
  });
});
