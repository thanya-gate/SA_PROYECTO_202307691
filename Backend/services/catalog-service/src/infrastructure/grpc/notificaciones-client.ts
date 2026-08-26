import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../../config/env';
import { container } from '../../container';

function resolveProtoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'proto', 'notificaciones.proto'),
    path.resolve(process.cwd(), '..', 'proto', 'notificaciones.proto'),
    path.resolve(process.cwd(), '..', '..', 'proto', 'notificaciones.proto'),
    path.resolve(__dirname, '../../../proto/notificaciones.proto'),
    path.resolve(__dirname, '../../../../proto/notificaciones.proto'),
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

export interface NotificarNuevaClaseInput {
  cursoId: string;
  semestre: string;
  anio: number;
  tema?: string;
}

/**
 * Cliente east-west hacia el notificaciones-service. Las llamadas nunca
 * lanzan hacia el llamador: si el microservicio de notificaciones no está
 * disponible, la publicación de la clase (CDU0006.2) no debe fallar.
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

  async notificarNuevaClase(input: NotificarNuevaClaseInput): Promise<void> {
    try {
      const curso = await container.catalogRepository.buscarCursoPorId(input.cursoId);
      if (!curso) {
        console.warn(
          `[catalog-service] no se pudo notificar la clase: curso ${input.cursoId} no encontrado en el catálogo`,
        );
        return;
      }
      const res = await unary(this.client, 'NotificarNuevaClase', {
        cursoId: input.cursoId,
        codigo: curso.codigo,
        curso: curso.nombre,
        semestre: input.semestre,
        anio: input.anio,
        tema: input.tema ?? '',
      });
      console.log(
        `[catalog-service] alerta de nueva clase encolada para ${res.notificacionesEncoladas} estudiante(s) (curso ${curso.codigo})`,
      );
    } catch (err: any) {
      console.error(
        `[catalog-service] no se pudo notificar la nueva clase del curso ${input.cursoId}:`,
        err?.message ?? err,
      );
    }
  }
}
