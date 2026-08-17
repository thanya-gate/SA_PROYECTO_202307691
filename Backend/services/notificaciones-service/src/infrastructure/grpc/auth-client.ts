import * as grpc from '@grpc/grpc-js';
import { config } from '../../config/env';
import { AuthGrpcClient, UsuarioInfo } from '../../application/ports/auth-grpc-client';
import { createGrpcClient, unary } from './client';

export class AuthGrpcClientImpl implements AuthGrpcClient {
  private readonly client: any;

  constructor() {
    this.client = createGrpcClient({
      protoFile: 'auth.proto',
      servicePath: ['yousac', 'auth', 'v1'],
      serviceName: 'AuthService',
      address: config.AUTH_GRPC_ADDR,
    });
  }

  async obtenerUsuario(usuarioId: string): Promise<UsuarioInfo | null> {
    try {
      const res = await unary(this.client, 'GetUser', { userId: usuarioId });
      return this.toUsuarioInfo(res.user);
    } catch (err: any) {
      if (err?.code === grpc.status.NOT_FOUND) {
        return null;
      }
      throw err;
    }
  }

  async listarEstudiantes(): Promise<UsuarioInfo[]> {
    const res = await unary(this.client, 'ListUsersByRole', {
      roles: ['ROLE_ESTUDIANTE'],
      incluirInactivos: false,
    });
    return (res.users ?? []).map((u: any) => this.toUsuarioInfo(u));
  }

  private toUsuarioInfo(u: any): UsuarioInfo {
    return {
      usuarioId: u.userId,
      email: u.email,
      nombres: u.nombres ?? '',
      apellidos: u.apellidos ?? '',
    };
  }
}
