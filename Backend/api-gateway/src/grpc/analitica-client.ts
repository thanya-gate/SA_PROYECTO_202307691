import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../config/env';
import { GrpcError } from './auth-client';

function resolveProtoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'proto', 'analitica.proto'),
    path.resolve(process.cwd(), '..', 'proto', 'analitica.proto'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`No se encontró el contrato gRPC analitica.proto. Buscado en: ${candidates.join(', ')}`);
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
  const analiticaProto = grpc.loadPackageDefinition(packageDefinition) as any;
  const AnaliticaService = analiticaProto.yousac.analitica.v1.AnaliticaService;
  return new AnaliticaService(config.ANALITICA_GRPC_ADDR, grpc.credentials.createInsecure());
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

export const analiticaGrpc = {
  health: () => unary('Health', {}),

  clasesMasVistas: (req: { semana?: string; limite?: number }) => unary('ClasesMasVistas', req),
  tendenciasExamenes: (req: { limite?: number }) => unary('TendenciasExamenes', req),
  rankingMejorValoradas: (req: { limite?: number }) => unary('RankingMejorValoradas', req),
  recomendacionesEstudiante: (req: { estudianteId: string; limite?: number }) =>
    unary('RecomendacionesEstudiante', req),

  sincronizarVista: (req: { claseId: string; estudianteId: string; duracionVista: number }) =>
    unary('SincronizarVista', req),
  sincronizarCalificacion: (req: { claseId: string; estudianteId: string; puntuacion: number }) =>
    unary('SincronizarCalificacion', req),
  cargarEventosCSV: (req: { contenido: string; reemplazar?: boolean }) =>
    unary('CargarEventosCSV', req),
  recalcularTendencias: (req: { semana?: string }) => unary('RecalcularTendencias', req),
};
