import { config } from './config/env';
import { container } from './container';
import { seedDevData } from './seed';
import { pingDb, closeDb } from './infrastructure/persistence/postgres/db';
import { createGrpcServer, listenGrpc } from './interfaces/grpc/server';

async function bootstrap(): Promise<void> {
  if (config.DATABASE_URL.trim().length > 0) {
    await pingDb();
    console.log('[auth-service] Conectado a PostgreSQL (Database per Microservice)');
  }

  if (config.NODE_ENV === 'development') {
    await seedDevData(container);
    console.log('[auth-service] Datos de desarrollo sembrados');
  }

  if (config.OAUTH_MOCK_ENABLED) {
    console.log(`[auth-service] OAuth mock institucional habilitado (issuer: ${config.OAUTH_MOCK_ISSUER})`);
  }

  // RNF-06 / enunciado: el tráfico interno (east-west) es 100% gRPC.
  // El auth-service NO expone superficie REST: solo habla por gRPC en :50051
  // y el API Gateway es el único punto de entrada hacia el cliente web.
  const grpcServer = createGrpcServer();
  await listenGrpc(grpcServer);
}

bootstrap().catch((err) => {
  console.error('[auth-service] Error al iniciar:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('[auth-service] Cerrando ...');
  await closeDb();
  process.exit(0);
});
