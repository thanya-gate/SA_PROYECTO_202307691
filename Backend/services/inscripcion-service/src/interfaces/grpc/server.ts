import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../../config/env';
import { container } from '../../container';
import {
  CursoCatedraticoItem,
  CursoInscripcion,
  PanelEstudianteItem,
} from '../../domain/entities/inscripcion';

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

function cursoToProto(c: CursoInscripcion) {
  return {
    cursoId: c.cursoId,
    codigo: c.codigo,
    nombre: c.nombre,
    escuela: c.escuela,
    semestre: c.semestre,
    anio: c.anio,
  };
}

function panelItemToProto(c: PanelEstudianteItem) {
  return {
    cursoId: c.cursoId,
    codigo: c.codigo,
    curso: c.curso,
    escuela: c.escuela,
    semestre: c.semestre,
    anio: c.anio,
    estadoMatricula: c.estadoMatricula,
    catedraticoUsuarioId: c.catedraticoUsuarioId ?? '',
  };
}

function cursoCatedraticoToProto(c: CursoCatedraticoItem) {
  return {
    cursoId: c.cursoId,
    codigo: c.codigo,
    curso: c.curso,
    semestre: c.semestre,
    anio: c.anio,
    auxiliares: c.auxiliares,
  };
}

const domainErrorToGrpcCode: Record<string, number> = {
  CURSO_NO_ENCONTRADO: 5,
  DOCENTE_NO_ENCONTRADO: 5,
  AUXILIAR_NO_ENCONTRADO: 5,
  INSCRIPCION_DUPLICADA: 6,
  CONFLICTO: 6,
  ENTRADA_INVALIDA: 3,
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
  const inscripcionProto = grpc.loadPackageDefinition(packageDefinition) as any;
  const InscripcionService = inscripcionProto.yousac.inscripcion.v1.InscripcionService;

  const handlers = {
    RegistrarCurso: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const curso = await container.inscripcionService.registrarCurso({
          codigo: call.request.codigo,
          nombre: call.request.nombre,
          escuela: call.request.escuela,
          semestre: call.request.semestre,
          anio: call.request.anio,
        });
        callback(null, { curso: cursoToProto(curso) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    RegistrarDocente: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const result = await container.inscripcionService.registrarDocente({
          usuarioId: call.request.usuarioId,
        });
        callback(null, { docenteId: result.docenteId });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    RegistrarAuxiliar: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const result = await container.inscripcionService.registrarAuxiliar({
          usuarioId: call.request.usuarioId,
        });
        callback(null, { auxiliarId: result.auxiliarId });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    InscribirEstudiante: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const result = await container.inscripcionService.inscribirEstudiante({
          estudianteId: call.request.estudianteId,
          cursoId: call.request.cursoId,
          semestre: call.request.semestre,
        });
        callback(null, {
          inscripcionId: result.inscripcionId,
          estadoMatricula: result.estadoMatricula,
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    AsignarCatedraticoCurso: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const result = await container.inscripcionService.asignarCatedraticoCurso({
          docenteId: call.request.docenteId,
          cursoId: call.request.cursoId,
          semestre: call.request.semestre,
        });
        callback(null, { asignacionId: result.asignacionId });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    AsignarAuxiliarCatedratico: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const result = await container.inscripcionService.asignarAuxiliarCatedratico({
          auxiliarId: call.request.auxiliarId,
          asignacionDocenteId: call.request.asignacionDocenteId,
        });
        callback(null, { asignacionAuxiliarId: result.asignacionAuxiliarId });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ConsultarPanelEstudiante: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const items = await container.inscripcionService.consultarPanelEstudiante(
          call.request.estudianteId,
        );
        callback(null, { items: items.map(panelItemToProto) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ConsultarCursosCatedratico: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const items = await container.inscripcionService.consultarCursosCatedratico(
          call.request.catedraticoUsuarioId,
        );
        callback(null, { items: items.map(cursoCatedraticoToProto) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ConsultarEstadoMatricula: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const estado = await container.inscripcionService.consultarEstadoMatricula(
          call.request.estudianteId,
          call.request.cursoId,
        );
        callback(null, { estado });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    Health: async (_call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      callback(null, { status: 'SERVING', service: 'inscripcion-service', version: '1.0.0' });
    },
  };

  server.addService(InscripcionService.service, handlers);
  return server;
}

export function listenGrpc(server: grpc.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${config.GRPC_PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        console.log(`[inscripcion-service] gRPC escuchando en 0.0.0.0:${port}`);
        resolve();
      },
    );
  });
}
