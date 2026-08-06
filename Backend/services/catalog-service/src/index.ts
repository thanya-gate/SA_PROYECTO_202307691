import { config } from './config/env';
import { pingDb, closeDb } from './infrastructure/persistence/postgres/db';
import { seedCatalogData } from './seed';
import { createGrpcServer, listenGrpc } from './interfaces/grpc/server';

async function bootstrap(): Promise<void> {
  await pingDb();
  console.log('[catalog-service] Conectado a PostgreSQL (Database per Microservice)');

  if (config.NODE_ENV === 'development') {
    await seedCatalogData();
    console.log('[catalog-service] Datos de catálogo sembrados');
  }


  const grpcServer = createGrpcServer();
  await listenGrpc(grpcServer);
}

bootstrap().catch((err) => {
  console.error('[catalog-service] Error al iniciar:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('[catalog-service] Cerrando ...');
  await closeDb();
  process.exit(0);
});
