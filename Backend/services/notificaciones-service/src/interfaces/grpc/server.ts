import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../../config/env';
import { container, Container } from '../../container';

function resolveProtoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'proto', 'notificaciones.proto'),
    path.resolve(process.cwd(), '..', 'proto', 'notificaciones.proto'),
    path.resolve(__dirname, '../../../proto/notificaciones.proto'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`No se encontró el contrato gRPC notificaciones.proto. Buscado en: ${candidates.join(', ')}`);
  }
  return found;
}

const domainErrorToGrpcCode: Record<string, number> = {
  PLANTILLA_NO_ENCONTRADA: 5,
  NOTIFICACION_NO_ENCONTRADA: 5,
  USUARIO_NO_ENCONTRADO: 5,
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

/** Servicio reemplazable para probar el adaptador sin PostgreSQL ni SMTP. */
export interface NotificacionesGrpcDependencies {
  notificacionService?: Container['notificacionService'];
}

export function createGrpcServer(dependencies: NotificacionesGrpcDependencies = {}): grpc.Server {
  const server = new grpc.Server();
  const notificacionService = dependencies.notificacionService ?? container.notificacionService;

  const packageDefinition = protoLoader.loadSync(resolveProtoPath(), {
    keepCase: false,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const notificacionesProto = grpc.loadPackageDefinition(packageDefinition) as any;
  const NotificacionesService = notificacionesProto.yousac.notificaciones.v1.NotificacionesService;

  const handlers = {
    RegistrarNotificacion: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const result = await notificacionService.registrarNotificacion({
          usuarioId: call.request.usuarioId,
          correoDestino: call.request.correoDestino,
          plantilla: call.request.plantilla,
          tipo: call.request.tipo,
          datosContexto: call.request.datosContexto ?? {},
        });
        callback(null, { notificacionId: result.notificacionId });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    NotificarNuevaClase: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const result = await notificacionService.notificarNuevaClase({
          cursoId: call.request.cursoId,
          codigo: call.request.codigo,
          curso: call.request.curso,
          semestre: call.request.semestre,
          anio: call.request.anio,
          tema: call.request.tema,
        });
        callback(null, {
          destinatarioIds: result.destinatarioIds,
          notificacionesEncoladas: result.notificacionesEncoladas,
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    NotificarVideoSubido: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const result = await notificacionService.notificarVideoSubido({
          cursoId: call.request.cursoId,
          codigo: call.request.codigo,
          curso: call.request.curso,
          semestre: call.request.semestre,
          anio: call.request.anio,
          tema: call.request.tema,
        });
        callback(null, {
          destinatarioIds: result.destinatarioIds,
          notificacionesEncoladas: result.notificacionesEncoladas,
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    RegistrarAvisoGeneral: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const result = await notificacionService.registrarAvisoGeneral({
          mensaje: call.request.mensaje,
          destinatarioIds: call.request.destinatarioIds ?? [],
        });
        callback(null, {
          destinatarioIds: result.destinatarioIds,
          notificacionesEncoladas: result.notificacionesEncoladas,
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ListarNotificaciones: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const items = await notificacionService.listarNotificaciones(
          call.request.usuarioId,
          call.request.limite > 0 ? call.request.limite : 50,
        );
        callback(null, {
          items: items.map((n) => ({
            id: n.id,
            tipo: n.tipo,
            asunto: n.asunto,
            cuerpo: n.cuerpo,
            estado: n.estado,
            fechaCreacion: n.fechaCreacion,
            fechaEnvio: n.fechaEnvio ?? '',
          })),
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ListarPlantillas: async (_call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const plantillas = await notificacionService.listarPlantillas();
        callback(null, {
          items: plantillas.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            asunto: p.asunto,
            cuerpo: p.cuerpo,
            tipo: p.tipo,
          })),
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ConsultarCola: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const items = await notificacionService.consultarCola(
          call.request.limite > 0 ? call.request.limite : 100,
        );
        callback(null, {
          items: items.map((c) => ({
            colaId: c.colaId,
            notificacionId: c.notificacionId,
            correoDestino: c.correoDestino,
            intentos: c.intentos,
            estado: c.estado,
            ultimoError: c.ultimoError ?? '',
            fechaProximoIntento: c.fechaProximoIntento ?? '',
            contenido: c.contenido,
          })),
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    Health: async (_call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      callback(null, { status: 'SERVING', service: 'notificaciones-service', version: '1.0.0' });
    },
  };

  server.addService(NotificacionesService.service, handlers);
  return server;
}

export function listenGrpc(server: grpc.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${config.GRPC_PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        console.log(`[notificaciones-service] gRPC escuchando en 0.0.0.0:${port}`);
        resolve();
      },
    );
  });
}
