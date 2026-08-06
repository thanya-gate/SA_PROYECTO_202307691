import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../config/env';
import { GrpcError } from './auth-client';

function resolveProtoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'proto', 'catalogo.proto'),
    path.resolve(process.cwd(), '..', 'proto', 'catalogo.proto'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`No se encontró el contrato gRPC catalogo.proto. Buscado en: ${candidates.join(', ')}`);
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
  const catalogProto = grpc.loadPackageDefinition(packageDefinition) as any;
  const CatalogoService = catalogProto.yousac.catalogo.v1.CatalogoService;
  return new CatalogoService(config.CATALOG_GRPC_ADDR, grpc.credentials.createInsecure());
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

export const catalogGrpc = {
  health: () => unary('Health', {}),

  search: (req: {
    semestre?: string;
    escuela?: string;
    curso?: string;
    catedratico?: string;
    tema?: string;
  }) => unary('Search', req),
  getClase: (claseId: string) => unary('GetClase', { claseId }),
  listarPorSemestre: (semestre?: string) => unary('ListarPorSemestre', { semestre }),

  publicarClase: (req: {
    cursoId: string;
    unidad?: string;
    tema?: string;
    fechaImparticion?: string;
    semestre: string;
    anio: number;
    urlVideo: string;
    urlMaterial?: string;
    duracion: number;
    etiquetas?: string[];
    participantes?: Array<{ nombre: string; rol: string }>;
  }) => unary('PublicarClase', req),
  actualizarUrlVideo: (claseId: string, urlVideo: string) =>
    unary('ActualizarUrlVideo', { claseId, urlVideo }),
  actualizarUrlMaterial: (claseId: string, urlMaterial: string) =>
    unary('ActualizarUrlMaterial', { claseId, urlMaterial }),
  actualizarDuracion: (claseId: string, duracion: number) =>
    unary('ActualizarDuracion', { claseId, duracion }),
  registrarCurso: (req: { codigo: string; nombre: string; escuela: string }) =>
    unary('RegistrarCurso', req),
  obtenerCursoPorCodigo: (codigo: string) => unary('ObtenerCursoPorCodigo', { codigo }),
};
