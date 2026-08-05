import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import * as fs from 'fs';

function resolveProtoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'proto', 'inscripcion.proto'),
    path.resolve(process.cwd(), '..', 'proto', 'inscripcion.proto'),
    path.resolve(__dirname, '../../../proto/inscripcion.proto'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`No se encontró el contrato gRPC inscripcion.proto. Buscado en: ${candidates.join(', ')}`);
  }
  return found;
}

const packageDefinition = protoLoader.loadSync(resolveProtoPath(), {
  keepCase: false,
  enums: String,
});

const pkg = grpc.loadPackageDefinition(packageDefinition) as any;
const InscripcionService = pkg.yousac.inscripcion.v1.InscripcionService;
const client = new InscripcionService('localhost:50055', grpc.credentials.createInsecure());

const deadline = new Date();
deadline.setSeconds(deadline.getSeconds() + 5);

client.Health({}, { deadline }, (err: grpc.ServiceError | null, res?: { status?: string }) => {
  if (err || res?.status !== 'SERVING') {
    console.error('[healthcheck] inscripcion-service gRPC no está SERVING:', err?.message ?? res?.status);
    process.exit(1);
  }
  console.log(`[healthcheck] inscripcion-service gRPC ${res.status}`);
  process.exit(0);
});
