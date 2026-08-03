import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../../config/env';
import { container } from '../../container';
import { Role } from '../../domain/enums/role';
import { SessionStatus } from '../../domain/enums/auth';
import { domainErrorToGrpcCode } from '../http/middleware/error-handler';

//Manejo del contraro de gRpc
function resolveProtoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'proto', 'auth.proto'),
    path.resolve(process.cwd(), '..', 'proto', 'auth.proto'),
    path.resolve(__dirname, '../../../proto/auth.proto'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`No se encontró el contrato gRPC auth.proto. Buscado en: ${candidates.join(', ')}`);
  }
  return found;
}

const roleToProto: Record<Role, string> = {
  [Role.ESTUDIANTE]: 'ROLE_ESTUDIANTE',
  [Role.CATEDRATICO]: 'ROLE_CATEDRATICO',
  [Role.AUXILIAR]: 'ROLE_AUXILIAR',
  [Role.ADMIN]: 'ROLE_ADMIN',
};

function statusToProto(status: SessionStatus): string {
  switch (status) {
    case SessionStatus.ACTIVA:
      return 'SESSION_STATUS_ACTIVA';
    case SessionStatus.EXPIRADA:
      return 'SESSION_STATUS_EXPIRADA';
    case SessionStatus.REVOCADA:
      return 'SESSION_STATUS_REVOCADA';
    default:
      return 'SESSION_STATUS_UNSPECIFIED';
  }
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
  const authProto = grpc.loadPackageDefinition(packageDefinition) as any;
  const AuthService = authProto.yousac.auth.v1.AuthService;

  const handlers = {
    ValidateSession: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const payload = await container.tokenService.verifyAccessToken(call.request.token);
        const validated = await container.sessionService.validate(payload.sessionId);
        if (!validated) {
          return callback({ code: grpc.status.UNAUTHENTICATED, message: 'Sesión no activa' });
        }
        const user = await container.userRepository.findById(payload.sub);
        if (!user) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'Usuario no encontrado' });
        }
        callback(null, {
          session: {
            sessionId: validated.session.sessionId,
            userId: user.userId,
            email: user.email,
            roles: user.roles.map((r) => roleToProto[r]),
            status: statusToProto(validated.session.status),
            issuedAt: validated.session.issuedAt.toISOString(),
            expiresAt: validated.session.expiresAt.toISOString(),
            ip: validated.session.ip ?? '',
            userAgent: validated.session.userAgent ?? '',
          },
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    GetUser: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const user = await container.userRepository.findById(call.request.userId);
        if (!user) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'Usuario no encontrado' });
        }
        callback(null, {
          user: {
            userId: user.userId,
            email: user.email,
            emailVerified: user.emailVerified,
            roles: user.roles.map((r) => roleToProto[r]),
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          },
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    GetProfiles: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const view = await container.profileService.getProfiles(call.request.userId);
        callback(null, {
          userId: view.userId,
          email: view.email,
          roles: view.roles.map((r) => roleToProto[r]),
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    CheckPermission: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const allowed = await container.profileService.checkPermission(
          call.request.userId,
          call.request.resource,
          call.request.action,
        );
        callback(null, { allowed });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    RevokeSession: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        await container.sessionService.revoke(call.request.sessionId);
        callback(null, { revoked: true });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    Health: async (_call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      callback(null, { status: 'SERVING', service: 'auth-service', version: '1.0.0' });
    },
  };

  server.addService(AuthService.service, handlers);
  return server;
}

export function listenGrpc(server: grpc.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.bindAsync(
      `0.0.0.0:${config.GRPC_PORT}`,
      grpc.ServerCredentials.createInsecure(),
      (err, port) => {
        if (err) return reject(err);
        // eslint-disable-next-line no-console
        console.log(`[auth-service] gRPC escuchando en 0.0.0.0:${port}`);
        resolve();
      },
    );
  });
}

function mapError(err: any): grpc.ServiceError {
  const code =
    err?.code && domainErrorToGrpcCode[err.code] !== undefined
      ? domainErrorToGrpcCode[err.code]
      : grpc.status.INTERNAL;
  const message = err?.message ?? 'Error interno';
  const details = err?.details ?? '';
  return { name: 'Error', message, code, details, metadata: new grpc.Metadata() } as grpc.ServiceError;
}
