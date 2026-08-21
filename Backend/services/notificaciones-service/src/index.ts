import { pingDb, closeDb } from './infrastructure/persistence/postgres/db';
import { createGrpcServer, listenGrpc } from './interfaces/grpc/server';
import { container } from './container';

async function bootstrap(): Promise<void> {
  await pingDb();
  console.log('[notificaciones-service] Conectado a PostgreSQL (Database per Microservice)');

  const grpcServer = createGrpcServer();
  await listenGrpc(grpcServer);

  container.emailWorker.start();
}

bootstrap().catch((err) => {
  console.error('[notificaciones-service] Error al iniciar:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('[notificaciones-service] Cerrando ...');
  container.emailWorker.stop();
  await closeDb();
  process.exit(0);
});
