import express from 'express';
import request from 'supertest';
import { marcarReproduccion, metricsMiddleware, observarGrpc, registry } from '../src/metrics';
import { GrpcError } from '../src/grpc/auth-client';

describe('Métricas Prometheus del gateway', () => {
  test('cuenta peticiones por ruta plantilla, gRPC y reproducciones activas', async () => {
    const app = express();
    app.use(metricsMiddleware);
    app.get('/clases/:id', (_req, res) => {
      res.json({ ok: true });
    });
    await request(app).get('/clases/123').expect(200);
    await request(app).get('/no-existe').expect(404);

    await observarGrpc('catalog', 'Health', Promise.resolve({}));
    await expect(observarGrpc('auth', 'Login', Promise.reject(new GrpcError(16, 'x')))).rejects.toThrow('x');
    marcarReproduccion('est-1', 'clase-1');

    const texto = await registry.metrics();
    expect(texto).toContain('http_requests_total{method="GET",route="/clases/:id",status="200"} 1');
    expect(texto).toContain('route="otra",status="404"');
    expect(texto).toContain('grpc_client_duration_seconds_count{servicio="catalog",metodo="Health",codigo="OK"} 1');
    expect(texto).toContain('codigo="16"');
    expect(texto).toContain('yousac_reproducciones_activas 1');
  });
});
