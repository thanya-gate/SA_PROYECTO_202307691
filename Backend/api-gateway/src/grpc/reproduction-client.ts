import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../config/env';
import { GrpcError } from './auth-client';

function resolveProtoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'proto', 'reproduccion.proto'),
    path.resolve(process.cwd(), '..', 'proto', 'reproduccion.proto'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`No se encontró el contrato gRPC reproduccion.proto. Buscado en: ${candidates.join(', ')}`);
  }
  return found;
}

function createClient(): any {
  const packageDefinition = protoLoader.loadSync(resolveProtoPath(), {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const reproduccionProto = grpc.loadPackageDefinition(packageDefinition) as any;
  const ReproduccionService = reproduccionProto.yousac.reproduccion.v1.ReproduccionService;
  return new ReproduccionService(config.REPRODUCTION_GRPC_ADDR, grpc.credentials.createInsecure());
}

function unary(method: string, req: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    client[method](req, (err: grpc.ServiceError | null, res: any) => {
      if (err) {
        reject(new GrpcError(err.code, err.message));
      } else {
        resolve(res);
      }
    });
  });
}

const client = createClient();

export const reproductionGrpc = {
  health: () => unary('Health', {}),

  guardarCheckpoint: (req: {
    estudianteId: string;
    claseId: string;
    segundoActual: number;
    duracion: number;
  }) => unary('GuardarCheckpoint', req),
  obtenerCheckpoint: (req: { estudianteId: string; claseId: string }) =>
    unary('ObtenerCheckpoint', req),
  historialReciente: (req: { estudianteId: string }) => unary('HistorialReciente', req),

  registrarCalificacion: (req: {
    historialId: string;
    puntuacion: number;
    comentario?: string;
  }) => unary('RegistrarCalificacion', req),

  guardarApunte: (req: {
    estudianteId: string;
    claseId: string;
    titulo: string;
    contenidoMarkdown: string;
  }) => unary('GuardarApunte', req),
  obtenerApunte: (req: { estudianteId: string; claseId: string }) =>
    unary('ObtenerApunte', req),
  listarApuntes: (req: { estudianteId: string }) => unary('ListarApuntes', req),
  eliminarApunte: (req: { estudianteId: string; claseId: string }) =>
    unary('EliminarApunte', req),
};
