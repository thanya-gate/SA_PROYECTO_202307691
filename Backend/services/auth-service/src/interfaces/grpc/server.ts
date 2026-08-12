import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../../config/env';
import { container } from '../../container';
import { Role } from '../../domain/enums/role';
import { User } from '../../domain/entities/user';
import { SessionStatus } from '../../domain/enums/auth';
import { SolicitudEstado, SolicitudRol } from '../../domain/entities/solicitud-rol';
import { DomainError } from '../../domain/errors/domain-error';
import { ZodError } from 'zod';
import { domainErrorToGrpcCode } from '../http/middleware/error-handler';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  assignRoleSchema,
  crearSolicitudRolSchema,
  resolverSolicitudRolSchema,
} from '../../application/dto/auth-schemas';

// El contrato gRPC vive en Backend/proto/auth.proto (carpeta compartida de
// contratos entre microservicios). Según cómo se ejecute el servicio cambia
// la ruta relativa, por eso se busca entre varias candidatas en orden.
function resolveProtoPath(): string {
  const candidates = [
    // Docker: WORKDIR /app con proto copiado en /app/proto
    path.resolve(process.cwd(), 'proto', 'auth.proto'),
    // Dev local (tsx): cwd = services/auth-service -> Backend/proto/auth.proto
    path.resolve(process.cwd(), '..', 'proto', 'auth.proto'),
    // Fallback: ruta relativa al módulo compilado (dist/interfaces/grpc)
    path.resolve(__dirname, '../../../proto/auth.proto'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`No se encontró el contrato gRPC auth.proto. Buscado en: ${candidates.join(', ')}`);
  }
  return found;
}

// Mapeo entre el enum TS y el enum proto (nombres ROLE_* / SESSION_STATUS_*).
const roleToProto: Record<Role, string> = {
  [Role.ESTUDIANTE]: 'ROLE_ESTUDIANTE',
  [Role.CATEDRATICO]: 'ROLE_CATEDRATICO',
  [Role.AUXILIAR]: 'ROLE_AUXILIAR',
  [Role.ADMIN]: 'ROLE_ADMIN',
};

const protoToRole: Record<string, Role> = {
  ROLE_ESTUDIANTE: Role.ESTUDIANTE,
  ROLE_CATEDRATICO: Role.CATEDRATICO,
  ROLE_AUXILIAR: Role.AUXILIAR,
  ROLE_ADMIN: Role.ADMIN,
};

const estadoToProto: Record<SolicitudEstado, string> = {
  PENDIENTE: 'SOLICITUD_ESTADO_PENDIENTE',
  ACEPTADA: 'SOLICITUD_ESTADO_ACEPTADA',
  RECHAZADA: 'SOLICITUD_ESTADO_RECHAZADA',
};

const protoToEstado: Record<string, SolicitudEstado> = {
  SOLICITUD_ESTADO_PENDIENTE: 'PENDIENTE',
  SOLICITUD_ESTADO_ACEPTADA: 'ACEPTADA',
  SOLICITUD_ESTADO_RECHAZADA: 'RECHAZADA',
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

function userToProto(u: User) {
  return {
    userId: u.userId,
    email: u.email,
    emailVerified: u.emailVerified,
    roles: u.roles.map((r) => roleToProto[r]),
    carnet: u.carnet ?? '',
    dpi: u.dpi ?? '',
    fechaNacimiento: u.fechaNacimiento ?? '',
    nombres: u.nombres ?? '',
    apellidos: u.apellidos ?? '',
    telefonoCelular: u.telefonoCelular ?? '',
    carrera: u.carrera ?? '',
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

function solicitudToProto(s: SolicitudRol) {
  return {
    solicitudId: s.solicitudId,
    usuarioId: s.usuarioId,
    correo: s.correo,
    nombres: s.nombres ?? '',
    apellidos: s.apellidos ?? '',
    carnet: s.carnet ?? '',
    rolSolicitado: roleToProto[s.rolSolicitado],
    estado: estadoToProto[s.estado],
    fechaSolicitud: s.fechaSolicitud.toISOString(),
    fechaResolucion: s.fechaResolucion ? s.fechaResolucion.toISOString() : '',
    resueltoPor: s.resueltoPor ?? '',
  };
}

type GrpcCall<T, U> = grpc.ServerUnaryCall<T, U>;
type GrpcCallback<U> = grpc.sendUnaryData<U>;

/**
 * Servidor gRPC (RNF-06 - tráfico east-west).
 * Expone el contrato completo de Auth para que el API Gateway y los demás
 * microservicios consuman identidad, sesiones y RBAC sin usar REST.
 */
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
    // ===== Sesión / validación =====
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

    // ===== Usuarios / perfiles =====
    GetUser: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const user = await container.userRepository.findById(call.request.userId);
        if (!user) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'Usuario no encontrado' });
        }
        callback(null, { user: userToProto(user) });
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

    ListUsersByRole: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const roles = (call.request.roles ?? [])
          .map((r: string) => protoToRole[r])
          .filter((r: Role | undefined): r is Role => Boolean(r));
        if (roles.length === 0) {
          throw new DomainError('ROL_INVALIDO', 'Debes indicar al menos un rol', 400);
        }
        const users = await container.userRepository.findByRoles(roles);
        callback(null, { users: users.map(userToProto) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    // ===== Autenticación =====
    Register: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const input = registerSchema.parse({
          email: call.request.email,
          password: call.request.password,
          confirmPassword: call.request.confirmPassword,
          carnet: call.request.carnet,
          dpi: call.request.dpi,
          fechaNacimiento: call.request.fechaNacimiento,
          rol: call.request.rol,
        });
        const result = await container.authService.register(input, {
          ip: call.request.ip,
          userAgent: call.request.userAgent,
        });
        callback(null, {
          user: userToProto(result.user),
          accessToken: result.accessToken,
          expiresAt: result.expiresAt.toISOString(),
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    Login: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const input = loginSchema.parse({
          email: call.request.email,
          password: call.request.password,
        });
        const result = await container.authService.login(input, {
          ip: call.request.ip,
          userAgent: call.request.userAgent,
        });
        callback(null, {
          user: userToProto(result.user),
          accessToken: result.accessToken,
          expiresAt: result.expiresAt.toISOString(),
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    Logout: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        await container.authService.logout(call.request.sessionId);
        callback(null, { revoked: true });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    GetCurrentUser: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const user = await container.authService.validateSession(call.request.sessionId);
        if (!user) {
          return callback({ code: grpc.status.UNAUTHENTICATED, message: 'Sesión no activa' });
        }
        callback(null, {
          user: userToProto(user),
          sessionId: call.request.sessionId,
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    // Validación de credenciales para el IdP institucional (no crea sesión).
    ValidateCredentials: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const user = await container.authService.validateCredentials(
          call.request.email,
          call.request.password,
        );
        callback(null, { user: userToProto(user) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    UpdateProfile: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const patch = (value: string): string | null | undefined => {
          if (value === '' || value === undefined) return undefined;
          return value;
        };
        const user = await container.profileService.updateProfile(call.request.userId, {
          nombres: patch(call.request.nombres),
          apellidos: patch(call.request.apellidos),
          carnet: patch(call.request.carnet),
          dpi: patch(call.request.dpi),
          fechaNacimiento: patch(call.request.fechaNacimiento),
          telefonoCelular: patch(call.request.telefonoCelular),
          carrera: patch(call.request.carrera),
        });
        callback(null, { user: userToProto(user) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    // ===== Cuenta =====
    RequestEmailVerification: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const { token } = await container.accountService.requestEmailVerification(call.request.email);
        callback(null, { token });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ConfirmEmailVerification: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        await container.accountService.confirmEmailVerification(call.request.token);
        callback(null, { verified: true });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    RequestPasswordReset: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const { token } = await container.accountService.requestPasswordReset(call.request.email);
        callback(null, { token });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ConfirmPasswordReset: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        await container.accountService.confirmPasswordReset(
          call.request.token,
          call.request.newPassword,
        );
        callback(null, { reset: true });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ChangePassword: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const input = changePasswordSchema.parse({
          currentPassword: call.request.currentPassword,
          newPassword: call.request.newPassword,
        });
        await container.accountService.changePassword(
          call.request.userId,
          input.currentPassword,
          input.newPassword,
        );
        callback(null, { changed: true });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    // ===== Perfiles / RBAC =====
    AssignRole: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const input = assignRoleSchema.parse({ role: protoToRole[call.request.role] });
        const view = await container.profileService.assignRole(call.request.userId, input.role);
        callback(null, {
          profiles: {
            userId: view.userId,
            email: view.email,
            roles: view.roles.map((r) => roleToProto[r]),
          },
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    RemoveRole: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const role = protoToRole[call.request.role];
        if (!role) {
          throw new DomainError('ROL_INVALIDO', 'Rol inválido', 400);
        }
        const view = await container.profileService.removeRole(call.request.userId, role);
        callback(null, {
          profiles: {
            userId: view.userId,
            email: view.email,
            roles: view.roles.map((r) => roleToProto[r]),
          },
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    SwitchProfile: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const role = protoToRole[call.request.role];
        if (!role) {
          throw new DomainError('ROL_INVALIDO', 'Rol inválido', 400);
        }
        await container.profileService.switchActiveProfile(
          call.request.userId,
          role,
          call.request.sessionId,
        );
        callback(null, { switched: true, pendingRole: call.request.role });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    // ===== Solicitudes de rol =====
    CrearSolicitudRol: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const input = crearSolicitudRolSchema.parse({
          rolSolicitado: protoToRole[call.request.rolSolicitado],
        });
        const solicitud = await container.solicitudService.crearSolicitud(
          call.request.usuarioId,
          input.rolSolicitado,
        );
        callback(null, { solicitud: solicitudToProto(solicitud) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ListarSolicitudesRol: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const estado =
          call.request.estado && call.request.estado !== 'SOLICITUD_ESTADO_UNSPECIFIED'
            ? protoToEstado[call.request.estado]
            : undefined;
        const solicitudes = await container.solicitudService.listarSolicitudes(estado);
        callback(null, { solicitudes: solicitudes.map(solicitudToProto) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    ResolverSolicitudRol: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const input = resolverSolicitudRolSchema.parse({
          solicitudId: call.request.solicitudId,
          aprobado: call.request.aprobado,
        });
        const solicitud = await container.solicitudService.resolverSolicitud(
          input.solicitudId,
          input.aprobado,
          call.request.resueltoPor,
        );
        callback(null, { solicitud: solicitudToProto(solicitud) });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    // ===== OAuth 2.0 (mock) =====
    OAuthAuthorize: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const code = container.oauthProvider.authorize(
          call.request.email,
          (call.request.roles ?? []).map((r: string) => protoToRole[r]),
        );
        callback(null, {
          redirectUri: `${config.OAUTH_REDIRECT_URI}?code=${code}`,
          code,
        });
      } catch (err: any) {
        callback(mapError(err));
      }
    },

    OAuthCallback: async (call: GrpcCall<any, any>, callback: GrpcCallback<any>) => {
      try {
        const profile = container.oauthProvider.exchange(call.request.code);
        const result = await container.authService.loginWithOAuth(profile, {
          ip: call.request.ip,
          userAgent: call.request.userAgent,
        });
        callback(null, {
          user: userToProto(result.user),
          accessToken: result.accessToken,
          expiresAt: result.expiresAt.toISOString(),
          provider: 'institucional',
        });
      } catch (err: any) {
        callback(mapError(err));
      }
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
  const message = err instanceof ZodError
    ? (() => {
        const first = err.issues[0];
        return first
          ? `${first.message}${first.path.length ? ` (${first.path.join('.')})` : ''}`
          : 'Datos de entrada inválidos';
      })()
    : (err?.message ?? 'Error interno');
  const code =
    err instanceof ZodError
      ? grpc.status.INVALID_ARGUMENT
      : err?.code && domainErrorToGrpcCode[err.code] !== undefined
        ? domainErrorToGrpcCode[err.code]
        : grpc.status.INTERNAL;
  // grpc-js transmite err.details como texto del error al cliente.
  return { name: 'Error', message, code, details: message, metadata: new grpc.Metadata() } as grpc.ServiceError;
}
