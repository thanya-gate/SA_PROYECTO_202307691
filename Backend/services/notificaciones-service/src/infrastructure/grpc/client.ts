import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

export interface GrpcClientOptions {
  protoFile: string;
  servicePath: string[];
  address: string;
  serviceName: string;
}

export function createGrpcClient(options: GrpcClientOptions): any {
  const candidates = [
    path.resolve(process.cwd(), 'proto', options.protoFile),
    path.resolve(process.cwd(), '..', 'proto', options.protoFile),
    path.resolve(__dirname, '../../../proto', options.protoFile),
  ];
  const protoPath = candidates.find((p) => fs.existsSync(p));
  if (!protoPath) {
    throw new Error(
      `No se encontró el contrato gRPC ${options.protoFile}. Buscado en: ${candidates.join(', ')}`,
    );
  }

  const packageDefinition = protoLoader.loadSync(protoPath, {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const pkg = grpc.loadPackageDefinition(packageDefinition) as any;
  let service = pkg;
  for (const segment of options.servicePath) {
    service = service[segment];
  }
  return new service[options.serviceName](options.address, grpc.credentials.createInsecure());
}

export function unary(
  client: any,
  method: string,
  req: Record<string, unknown>,
  timeoutMs = 5000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setMilliseconds(deadline.getTime() + timeoutMs);
    client[method](req, { deadline }, (err: grpc.ServiceError | null, res: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}
