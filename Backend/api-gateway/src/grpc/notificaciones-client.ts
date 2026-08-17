import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../config/env';
import { GrpcError } from './auth-client';

function resolveProtoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'proto', 'notificaciones.proto'),
    path.resolve(process.cwd(), '..', 'proto', 'notificaciones.proto'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`No se encontró el contrato gRPC notificaciones.proto. Buscado en: ${candidates.join(', ')}`);
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
  const notificacionesProto = grpc.loadPackageDefinition(packageDefinition) as any;
  const NotificacionesService = notificacionesProto.yousac.notificaciones.v1.NotificacionesService;
  return new NotificacionesService(config.NOTIFICACIONES_GRPC_ADDR, grpc.credentials.createInsecure());
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

export const notificacionesGrpc = {
  health: () => unary('Health', {}),

  registrarAvisoGeneral: (req: { mensaje: string; destinatarioIds?: string[] }) =>
    unary('RegistrarAvisoGeneral', req),
  listarNotificaciones: (usuarioId: string, limite?: number) =>
    unary('ListarNotificaciones', { usuarioId, limite: limite ?? 50 }),
  listarPlantillas: () => unary('ListarPlantillas', {}),
  consultarCola: (limite?: number) => unary('ConsultarCola', { limite: limite ?? 100 }),
};
