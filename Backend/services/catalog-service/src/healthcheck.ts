import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import * as fs from 'fs';

function resolveProtoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'proto', 'catalogo.proto'),
    path.resolve(process.cwd(), '..', 'proto', 'catalogo.proto'),
    path.resolve(__dirname, '../../../proto/catalogo.proto'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`No se encontró el contrato gRPC catalogo.proto. Buscado en: ${candidates.join(', ')}`);
  }
  return found;
}

const packageDefinition = protoLoader.loadSync(resolveProtoPath(), {
  keepCase: false,
  enums: String,
});

const pkg = grpc.loadPackageDefinition(packageDefinition) as any;
const CatalogoService = pkg.yousac.catalogo.v1.CatalogoService;
const client = new CatalogoService('localhost:50052', grpc.credentials.createInsecure());

const deadline = new Date();
deadline.setSeconds(deadline.getSeconds() + 5);

client.Health({}, { deadline }, (err: grpc.ServiceError | null, res?: { status?: string }) => {
  if (err || res?.status !== 'SERVING') {
    console.error('[healthcheck] catalog-service gRPC no está SERVING:', err?.message ?? res?.status);
    process.exit(1);
  }
  console.log(`[healthcheck] catalog-service gRPC ${res.status}`);
  process.exit(0);
});
