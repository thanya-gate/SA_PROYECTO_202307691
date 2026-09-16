import request from 'supertest';
import { createGateway } from '../src/server';

function healthDependencies() {
  const health = jest.fn().mockResolvedValue({ status: 'SERVING' });
  return {
    authGrpc: { health, register: jest.fn() },
    catalogGrpc: { health },
    reproductionGrpc: { health },
    analiticaGrpc: { health },
    inscripcionGrpc: { health },
    notificacionesGrpc: { health },
    health,
  };
}

describe('gateway: contrato HTTP detrás del Ingress de Kubernetes', () => {
  test('expone liveness mediante /api/health/live sin depender de los microservicios', async () => {
    const dependencies = healthDependencies();
    const app = createGateway(dependencies as any);

    await request(app)
      .get('/api/health/live')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'ok', service: 'api-gateway' });
      });

    expect(dependencies.health).not.toHaveBeenCalled();
  });

  test('elimina /api y devuelve 200 en /api/health cuando todos los servicios están SERVING', async () => {
    const dependencies = healthDependencies();
    const app = createGateway(dependencies as any);

    await request(app)
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: 'ok',
          authService: 'SERVING',
          catalogService: 'SERVING',
          reproductionService: 'SERVING',
          analiticaService: 'SERVING',
          inscripcionService: 'SERVING',
          notificacionesService: 'SERVING',
        });
      });

    expect(dependencies.health).toHaveBeenCalledTimes(6);
  });

  test('mantiene operativas las rutas existentes bajo el prefijo /api', async () => {
    const dependencies = healthDependencies();
    dependencies.authGrpc.register.mockResolvedValue({
      accessToken: 'token-de-prueba',
      expiresAt: '2030-01-01T00:00:00.000Z',
      user: {
        userId: 'user-1',
        email: 'estudiante@ingenieria.usac.edu.gt',
        emailVerified: false,
        roles: ['ROLE_ESTUDIANTE'],
      },
    });
    const app = createGateway(dependencies as any);

    await request(app)
      .post('/api/auth/register')
      .send({
        email: 'estudiante@ingenieria.usac.edu.gt',
        password: 'password-seguro',
        confirmPassword: 'password-seguro',
        rol: 'ESTUDIANTE',
      })
      .expect(201);

    expect(dependencies.authGrpc.register).toHaveBeenCalled();
  });

  test('devuelve 503 en readiness cuando un microservicio no está disponible', async () => {
    const dependencies = healthDependencies();
    dependencies.catalogGrpc.health.mockResolvedValue({ status: 'NOT_SERVING' });
    const app = createGateway(dependencies as any);

    await request(app)
      .get('/api/health')
      .expect(503)
      .expect(({ body }) => {
        expect(body.status).toBe('degraded');
        expect(body.catalogService).toBe('NOT_SERVING');
      });
  });
});
