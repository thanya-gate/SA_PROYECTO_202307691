import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import * as fs from 'fs';

function resolveProtoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'proto', 'notificaciones.proto'),
    path.resolve(process.cwd(), '..', 'proto', 'notificaciones.proto'),
    path.resolve(__dirname, '../../../proto/notificaciones.proto'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`No se encontró el contrato gRPC notificaciones.proto. Buscado en: ${candidates.join(', ')}`);
  }
  return found;
}

const packageDefinition = protoLoader.loadSync(resolveProtoPath(), {
  keepCase: false,
  enums: String,
});

const pkg = grpc.loadPackageDefinition(packageDefinition) as any;
const NotificacionesService = pkg.yousac.notificaciones.v1.NotificacionesService;
const client = new NotificacionesService('localhost:50056', grpc.credentials.createInsecure());

const deadline = new Date();
deadline.setSeconds(deadline.getSeconds() + 5);

client.Health({}, { deadline }, (err: grpc.ServiceError | null, res?: { status?: string }) => {
  if (err || res?.status !== 'SERVING') {
    console.error('[healthcheck] notificaciones-service gRPC no está SERVING:', err?.message ?? res?.status);
    process.exit(1);
  }
  console.log(`[healthcheck] notificaciones-service gRPC ${res.status}`);
  process.exit(0);
});
