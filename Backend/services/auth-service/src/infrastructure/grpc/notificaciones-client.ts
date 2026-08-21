import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../../config/env';
import { User } from '../../domain/entities/user';

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

function unary(client: any, method: string, req: Record<string, unknown>): Promise<any> {
  return new Promise((resolve, reject) => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 5);
    client[method](req, { deadline }, (err: grpc.ServiceError | null, res: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

/**
 * Cliente east-west hacia el notificaciones-service. Las llamadas nunca
 * lanzan hacia el llamador: si el microservicio de notificaciones no está
 * disponible, el registro (CDU0006.1) no debe fallar; solo se registra el error.
 */
export class NotificacionesGrpcClient {
  private readonly client: any;

  constructor() {
    const packageDefinition = protoLoader.loadSync(resolveProtoPath(), {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const pkg = grpc.loadPackageDefinition(packageDefinition) as any;
    const NotificacionesService = pkg.yousac.notificaciones.v1.NotificacionesService;
    this.client = new NotificacionesService(
      config.NOTIFICACIONES_GRPC_ADDR,
      grpc.credentials.createInsecure(),
    );
  }

  async notificarConfirmacionRegistro(user: User): Promise<void> {
    const nombre = [user.nombres, user.apellidos].filter(Boolean).join(' ').trim() || user.email;
    try {
      const res = await unary(this.client, 'RegistrarNotificacion', {
        usuarioId: user.userId,
        correoDestino: user.email,
        plantilla: 'confirmacion_registro',
        tipo: 'REGISTRO',
        datosContexto: {
          nombre,
          correo: user.email,
        },
      });
      console.log(
        `[auth-service] confirmación de registro encolada para ${user.email} (notificacion=${res.notificacionId})`,
      );
    } catch (err: any) {
      console.error(
        `[auth-service] no se pudo notificar la confirmación de registro de ${user.email}:`,
        err?.message ?? err,
      );
    }
  }
}
