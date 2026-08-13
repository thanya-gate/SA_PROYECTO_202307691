import { config } from './config/env';
import { pingDb, closeDb } from './infrastructure/persistence/postgres/db';
import { seedInscripcionData } from './seed';
import { createGrpcServer, listenGrpc } from './interfaces/grpc/server';

async function bootstrap(): Promise<void> {
  await pingDb();
  console.log('[inscripcion-service] Conectado a PostgreSQL (Database per Microservice)');

  if (config.SEED_DEMO) {
    await seedInscripcionData();
    console.log('[inscripcion-service] Datos de inscripción sembrados');
  }

  const grpcServer = createGrpcServer();
  await listenGrpc(grpcServer);
}

bootstrap().catch((err) => {
  console.error('[inscripcion-service] Error al iniciar:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('[inscripcion-service] Cerrando ...');
  await closeDb();
  process.exit(0);
});
