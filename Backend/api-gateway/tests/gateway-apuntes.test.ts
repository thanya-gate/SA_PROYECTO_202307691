import request from 'supertest';
import { createGateway } from '../src/server';

const apunte = {
  apunteId: 'apunte-1',
  estudianteId: 'estudiante-1',
  claseId: 'clase-1',
  titulo: 'Resumen',
  contenidoMarkdown: '# Tema\n\n[01:30] concepto',
  posicionSegundos: 90,
  fechaCreacion: '2026-09-01T10:00:00.000Z',
  fechaActualizacion: '2026-09-01T10:00:00.000Z',
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
    listarApuntes: jest.fn().mockResolvedValue({ apuntes: [apunte] }),
    guardarApunte: jest.fn().mockResolvedValue({ apunte }),
    eliminarApunte: jest.fn().mockResolvedValue({ eliminado: true }),
    exportarApunteMd: jest.fn().mockResolvedValue({
      nombreArchivo: 'apuntes-clase-1.md',
      contenidoMd: '# Resumen\n\n[01:30] concepto',
      mimeType: 'text/markdown; charset=utf-8',
    }),
  };
  const app = createGateway({ authGrpc: auth as any, reproductionGrpc: reproduction as any });
  return { app, auth, reproduction };
}

describe('gateway: cuaderno de apuntes', () => {
  test('exige sesión y uno de los roles permitidos', async () => {
    const noSession = makeHarness();
    await request(noSession.app).get('/reproduccion/apuntes').expect(401);
    expect(noSession.auth.validateSession).not.toHaveBeenCalled();
    expect(noSession.reproduction.listarApuntes).not.toHaveBeenCalled();

    const teacher = makeHarness();
    await request(teacher.app)
      .get('/reproduccion/apuntes')
      .set('Authorization', 'Bearer teacher')
      .expect(403);
    expect(teacher.reproduction.listarApuntes).not.toHaveBeenCalled();
  });

  test('lista solo los apuntes del estudiante autenticado y admite filtro por clase', async () => {
    const harness = makeHarness();
    const response = await request(harness.app)
      .get('/reproduccion/apuntes?claseId=clase%2Funo')
      .set('Authorization', 'Bearer student')
      .expect(200);

    expect(harness.reproduction.listarApuntes).toHaveBeenCalledWith({
      estudianteId: 'estudiante-1',
      claseId: 'clase/uno',
    });
    expect(response.body).toEqual({ apuntes: [apunte] });
  });

  test('crea un apunte, normaliza la posición y no permite suplantar al estudiante', async () => {
    const harness = makeHarness();
    await request(harness.app)
      .post('/reproduccion/apuntes')
      .set('Authorization', 'Bearer student')
      .send({
        estudianteId: 'otro-estudiante',
        claseId: 'clase-1',
        titulo: 'Resumen',
        contenidoMarkdown: '[01:30] concepto',
        posicionSegundos: 90.9,
      })
      .expect(201);

    expect(harness.reproduction.guardarApunte).toHaveBeenCalledWith({
      estudianteId: 'estudiante-1',
      claseId: 'clase-1',
      apunteId: '',
      titulo: 'Resumen',
      contenidoMarkdown: '[01:30] concepto',
      posicionSegundos: 90,
    });
  });

  test('actualiza por apunteId y limita una posición negativa a cero', async () => {
    const harness = makeHarness();
    await request(harness.app)
      .post('/reproduccion/apuntes')
      .set('Authorization', 'Bearer student')
      .send({
        apunteId: 'apunte-1',
        claseId: 'clase-1',
        titulo: 'Editado',
        contenidoMarkdown: 'Contenido',
        posicionSegundos: -20,
      })
      .expect(200);

    expect(harness.reproduction.guardarApunte).toHaveBeenCalledWith(expect.objectContaining({
      estudianteId: 'estudiante-1',
      apunteId: 'apunte-1',
      posicionSegundos: 0,
    }));
  });

  test.each([
    { body: { titulo: 'Sin clase', contenidoMarkdown: 'texto' }, caso: 'campos requeridos' },
    { body: { claseId: 'clase-1', titulo: 'Mal', contenidoMarkdown: '[01:60]' }, caso: 'segundos fuera de rango' },
    { body: { claseId: 'clase-1', titulo: 'Mal', contenidoMarkdown: '[1:30]' }, caso: 'formato que no es MM:SS' },
  ])('rechaza $caso antes de invocar gRPC', async ({ body }) => {
    const harness = makeHarness();
    await request(harness.app)
      .post('/reproduccion/apuntes')
      .set('Authorization', 'Bearer student')
      .send(body)
      .expect(400);
    expect(harness.reproduction.guardarApunte).not.toHaveBeenCalled();
  });

  test('elimina el apunte dentro del contexto del estudiante autenticado', async () => {
    const harness = makeHarness();
    await request(harness.app)
      .delete('/reproduccion/apuntes/apunte%2F1')
      .set('Authorization', 'Bearer student')
      .expect(200, { message: 'Apunte eliminado', eliminado: true });

    expect(harness.reproduction.eliminarApunte).toHaveBeenCalledWith({
      estudianteId: 'estudiante-1',
      apunteId: 'apunte/1',
    });
  });

  test('exporta el cuaderno Markdown con nombre y tipo de archivo', async () => {
    const harness = makeHarness();
    const response = await request(harness.app)
      .get('/reproduccion/apuntes/clase-1/exportar')
      .set('Authorization', 'Bearer student')
      .expect(200);

    expect(harness.reproduction.exportarApunteMd).toHaveBeenCalledWith({
      estudianteId: 'estudiante-1',
      claseId: 'clase-1',
    });
    expect(response.headers['content-type']).toMatch(/^text\/markdown/);
    expect(response.headers['content-disposition']).toBe('attachment; filename="apuntes-clase-1.md"');
    expect(response.text).toBe('# Resumen\n\n[01:30] concepto');
  });
});
