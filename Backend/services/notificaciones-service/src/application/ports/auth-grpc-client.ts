export interface UsuarioInfo {
  usuarioId: string;
  email: string;
  nombres: string;
  apellidos: string;
}

export interface AuthGrpcClient {
  obtenerUsuario(usuarioId: string): Promise<UsuarioInfo | null>;
  listarEstudiantes(): Promise<UsuarioInfo[]>;
}
