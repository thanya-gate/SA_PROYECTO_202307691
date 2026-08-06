import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../../config/env';
import { container } from '../../container';
import {
  ClaseDetalle,
  ClaseResumen,
  SemestreResumen,
} from '../../domain/entities/clase';

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

function claseResumenToProto(c: ClaseResumen) {
  return {
    claseId: c.claseId,
    codigo: c.codigo,
    curso: c.curso,
    unidad: c.unidad ?? '',
    tema: c.tema ?? '',
    semestre: c.semestre,
    anio: c.anio,
    urlVideo: c.urlVideo,
  };
}

function claseDetalleToProto(c: ClaseDetalle) {
  return {
    claseId: c.claseId,
    codigo: c.codigo,
    curso: c.curso,
    escuela: c.escuela,
    unidad: c.unidad ?? '',
    tema: c.tema ?? '',
    fechaImparticion: c.fechaImparticion ?? '',
    semestre: c.semestre,
    anio: c.anio,
    duracion: c.duracion,
    urlVideo: c.urlVideo,
    urlMaterial: c.urlMaterial ?? '',
    fechaPublicacion: c.fechaPublicacion,
    participantes: c.participantes.map((p) => ({ nombre: p.nombre, rol: p.rol })),
    etiquetas: c.etiquetas,
  };
}

function semestreToProto(s: SemestreResumen) {
  return {
    semestre: s.semestre,
    anio: s.anio,
    escuela: s.escuela,
    totalClases: s.totalClases,
  };
}

const domainErrorToGrpcCode: Record<string, number> = {
  CLASE_NO_ENCONTRADA: 5, 
  CURSO_NO_ENCONTRADO: 5, 
  ENTRADA_INVALIDA: 3, 
  CONFLICTO: 6,
};

function mapError(err: any): grpc.ServiceError {
  const code =
    err?.code && domainErrorToGrpcCode[err.code] !== undefined
      ? domainErrorToGrpcCode[err.code]
      : grpc.status.INTERNAL;
  const message = err?.message ?? 'Error interno';
  const details = err?.details ?? '';
  return { name: 'Error', message, code, details, metadata: new grpc.Metadata() } as grpc.ServiceError;
}

type GrpcCall<T, U> = grpc.ServerUnaryCall<T, U>;
type GrpcCallback<U> = grpc.sendUnaryData<U>;


export function createGrpcServer(): grpc.Server {
  const server = new grpc.Server();

  const packageDefinition = protoLoader.loadSync(resolveProtoPath(), {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const catalogProto = grpc.loadPackageDefinition(packageDefinition) as any;
  const CatalogoService = catalogProto.yousac.catalogo.v1.CatalogoService;

  const handlers = {

    Search: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const resultados = await container.catalogService.search({
          semestre: call.request.semestre,
          escuela: call.request.escuela,
          curso: call.request.curso,
          catedratico: call.request.catedratico,
          tema: call.request.tema,
        });
        callback(null, { resultados: resultados.map(claseResumenToProto) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    GetClase: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const clase = await container.catalogService.getClase(call.request.claseId);
        callback(null, { clase: claseDetalleToProto(clase) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ListarPorSemestre: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const semestres = await container.catalogService.listarPorSemestre(
          call.request.semestre || undefined,
        );
        callback(null, { semestres: semestres.map(semestreToProto) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    PublicarClase: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const result = await container.catalogService.publicarClase({
          cursoId: call.request.cursoId,
          unidad: call.request.unidad || undefined,
          tema: call.request.tema || undefined,
          fechaImparticion: call.request.fechaImparticion || undefined,
          semestre: call.request.semestre,
          anio: call.request.anio,
          urlVideo: call.request.urlVideo,
          urlMaterial: call.request.urlMaterial || undefined,
          duracion: call.request.duracion,
          etiquetas: call.request.etiquetas ?? [],
          participantes: (call.request.participantes ?? []).map((p: any) => ({
            nombre: p.nombre,
            rol: p.rol,
          })),
        });
        callback(null, {
          claseId: result.claseId,
          fechaPublicacion: result.fechaPublicacion,
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ActualizarUrlVideo: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const clase = await container.catalogService.actualizarUrlVideo(
          call.request.claseId,
          call.request.urlVideo,
        );
        callback(null, { clase: claseDetalleToProto(clase) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ActualizarUrlMaterial: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const clase = await container.catalogService.actualizarUrlMaterial(
          call.request.claseId,
          call.request.urlMaterial,
        );
        callback(null, { clase: claseDetalleToProto(clase) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ActualizarDuracion: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const clase = await container.catalogService.actualizarDuracion(
          call.request.claseId,
          call.request.duracion,
        );
        callback(null, { clase: claseDetalleToProto(clase) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    RegistrarCurso: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const curso = await container.catalogService.registrarCurso({
          codigo: call.request.codigo,
          nombre: call.request.nombre,
          escuela: call.request.escuela,
        });
        callback(null, {
          curso: {
            cursoId: curso.cursoId,
            codigo: curso.codigo,
            nombre: curso.nombre,
            escuela: curso.escuela,
          },
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ObtenerCursoPorCodigo: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const curso = await container.catalogService.obtenerCursoPorCodigo(call.request.codigo);
        callback(null, {
          curso: {
            cursoId: curso.cursoId,
            codigo: curso.codigo,
            nombre: curso.nombre,
            escuela: curso.escuela,
          },
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    Health: async (_call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      callback(null, { status: 'SERVING', service: 'catalog-service', version: '1.0.0' });
    },
  };

  server.addService(CatalogoService.service, handlers);
  return server;
}

export function listenGrpc(server: grpc.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${config.GRPC_PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        console.log(`[catalog-service] gRPC escuchando en 0.0.0.0:${port}`);
        resolve();
      },
    );
  });
}
