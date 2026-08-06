import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import * as fs from 'fs';

function resolveProtoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'proto', 'auth.proto'),
    path.resolve(process.cwd(), '..', 'proto', 'auth.proto'),
    path.resolve(__dirname, '../../../proto/auth.proto'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`No se encontró el contrato gRPC auth.proto. Buscado en: ${candidates.join(', ')}`);
  }
  return found;
}

const packageDefinition = protoLoader.loadSync(resolveProtoPath(), {
  keepCase: false,
  enums: String,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pkg = grpc.loadPackageDefinition(packageDefinition) as any;
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
const AuthService = pkg.yousac.auth.v1.AuthService;
const client = new AuthService('localhost:50051', grpc.credentials.createInsecure());

const deadline = new Date();
deadline.setSeconds(deadline.getSeconds() + 5);

client.Health({}, { deadline }, (err: grpc.ServiceError | null, res?: { status?: string }) => {
  if (err || res?.status !== 'SERVING') {
    console.error('[healthcheck] auth-service gRPC no está SERVING:', err?.message ?? res?.status);
    process.exit(1);
  }
  console.log(`[healthcheck] auth-service gRPC ${res.status}`);
  process.exit(0);
});
