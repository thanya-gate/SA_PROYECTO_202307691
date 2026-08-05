import path from 'path';
import fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { config } from '../config/env';

function resolveProtoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'proto', 'auth.proto'),
    path.resolve(process.cwd(), '..', 'proto', 'auth.proto'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`No se encontró el contrato gRPC auth.proto. Buscado en: ${candidates.join(', ')}`);
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
  const authProto = grpc.loadPackageDefinition(packageDefinition) as any;
  const AuthService = authProto.yousac.auth.v1.AuthService;
  return new AuthService(config.AUTH_GRPC_ADDR, grpc.credentials.createInsecure());
}

export class GrpcError extends Error {
  readonly grpcCode: number;

  constructor(grpcCode: number, message: string) {
    super(message.replace(/^\d+\s+[A-Z_]+:\s*/, ''));
    this.grpcCode = grpcCode;
  }
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

export const authGrpc = {
  health: () => unary('Health', {}),

  validateSession: (token: string) => unary('ValidateSession', { token }),
  revokeSession: (sessionId: string) => unary('RevokeSession', { sessionId }),

  register: (req: {
    email: string;
    password: string;
    confirmPassword: string;
    carnet: string;
    dpi: string;
    fechaNacimiento: string;
    ip?: string;
    userAgent?: string;
  }) => unary('Register', req),
  login: (req: { email: string; password: string; ip?: string; userAgent?: string }) => unary('Login', req),
  logout: (sessionId: string) => unary('Logout', { sessionId }),
  getCurrentUser: (sessionId: string) => unary('GetCurrentUser', { sessionId }),

  getProfiles: (userId: string) => unary('GetProfiles', { userId }),
  switchProfile: (userId: string, role: string, sessionId: string) =>
    unary('SwitchProfile', { userId, role, sessionId }),
  checkPermission: (userId: string, resource: string, action: string) =>
    unary('CheckPermission', { userId, resource, action }),
  assignRole: (userId: string, role: string) => unary('AssignRole', { userId, role }),
  removeRole: (userId: string, role: string) => unary('RemoveRole', { userId, role }),

  requestEmailVerification: (email: string) => unary('RequestEmailVerification', { email }),
  confirmEmailVerification: (token: string) => unary('ConfirmEmailVerification', { token }),
  requestPasswordReset: (email: string) => unary('RequestPasswordReset', { email }),
  confirmPasswordReset: (token: string, newPassword: string) =>
    unary('ConfirmPasswordReset', { token, newPassword }),
  changePassword: (userId: string, currentPassword: string, newPassword: string) =>
    unary('ChangePassword', { userId, currentPassword, newPassword }),

  oauthAuthorize: (email: string, roles?: string[]) => unary('OAuthAuthorize', { email, roles }),
  oauthCallback: (code: string, ip?: string, userAgent?: string) =>
    unary('OAuthCallback', { code, ip, userAgent }),
};
