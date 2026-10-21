import { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Peticiones HTTP atendidas por el gateway',
  labelNames: ['method', 'route', 'status'],
  registers: [registry],
});

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Latencia de las peticiones HTTP del gateway',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

const grpcDuration = new client.Histogram({
  name: 'grpc_client_duration_seconds',
  help: 'Latencia de las llamadas gRPC del gateway a los microservicios',
  labelNames: ['servicio', 'metodo', 'codigo'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

// Una reproducción está activa si su checkpoint llegó en los últimos 60 s.
const VENTANA_ACTIVA_MS = 60_000;
const reproducciones = new Map<string, number>();

new client.Gauge({
  name: 'yousac_reproducciones_activas',
  help: 'Pares estudiante-clase con checkpoint en el último minuto',
  registers: [registry],
  collect() {
    const limite = Date.now() - VENTANA_ACTIVA_MS;
    for (const [clave, visto] of reproducciones) if (visto < limite) reproducciones.delete(clave);
    this.set(reproducciones.size);
  },
});

export function marcarReproduccion(estudianteId: string, claseId: string): void {
  reproducciones.set(`${estudianteId}:${claseId}`, Date.now());
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const fin = httpDuration.startTimer();
  res.on('finish', () => {
    // Ruta plantilla (no la URL real) para no disparar la cardinalidad.
    const route = req.route ? `${req.baseUrl}${req.route.path}` : 'otra';
    fin({ method: req.method, route });
    httpRequests.inc({ method: req.method, route, status: String(res.statusCode) });
  });
  next();
}

export function observarGrpc<T>(servicio: string, metodo: string, promesa: Promise<T>): Promise<T> {
  const fin = grpcDuration.startTimer({ servicio, metodo });
  return promesa.then(
    (res) => {
      fin({ codigo: 'OK' });
      return res;
    },
    (err) => {
      fin({ codigo: String(err?.grpcCode ?? 'ERROR') });
      throw err;
    },
  );
}
