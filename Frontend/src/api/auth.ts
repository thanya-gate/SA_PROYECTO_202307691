import { apiFetch } from './http';

export interface PublicUser {
  userId: string;
  email: string;
  emailVerified: boolean;
  roles: string[];
  carnet?: string | null;
  dpi?: string | null;
  fechaNacimiento?: string | null;
  nombres?: string | null;
  apellidos?: string | null;
  telefonoCelular?: string | null;
  carrera?: string | null;
}

export interface UpdateProfileInput {
  nombres?: string;
  apellidos?: string;
  carnet?: string;
  dpi?: string;
  fechaNacimiento?: string;
  telefonoCelular?: string;
  carrera?: string;
}

export type RegisterRole = 'ESTUDIANTE' | 'CATEDRATICO';

export interface RegisterInput {
  email: string;
  password: string;
  confirmPassword: string;
  carnet: string;
  dpi: string;
  fechaNacimiento: string;
  rol: RegisterRole;
}

export interface AuthResponse {
  message: string;
  user: PublicUser;
  accessToken: string;
  expiresAt: string;
}

export interface MeResponse {
  user: PublicUser;
  sessionId: string;
}

export interface OAuthAuthorizeResponse {
  login_uri: string;
}

export type RolSolicitado = 'CATEDRATICO' | 'AUXILIAR';
export type SolicitudEstado = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA';

export interface SolicitudRolItem {
  solicitudId: string;
  usuarioId: string;
  correo: string;
  nombres: string;
  apellidos: string;
  carnet: string;
  rolSolicitado: string;
  estado: SolicitudEstado;
  fechaSolicitud: string;
  fechaResolucion: string;
  resueltoPor: string;
}

export interface PerfilesResponse {
  userId: string;
  email: string;
  roles: string[];
}

export const authApi = {
  login: (email: string, password: string): Promise<AuthResponse> =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),

  register: (input: RegisterInput): Promise<AuthResponse> =>
    apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: input,
    }),

  me: (token: string): Promise<MeResponse> => apiFetch<MeResponse>('/auth/me', { token }),

  listarUsuariosPorRol: (token: string, roles: string[]): Promise<{ usuarios: PublicUser[] }> => {
    const query = roles.map((r) => `rol=${encodeURIComponent(r)}`).join('&');
    return apiFetch<{ usuarios: PublicUser[] }>(`/auth/usuarios?${query}`, { token });
  },

  asignarRol: (token: string, userId: string, role: string): Promise<PerfilesResponse> =>
    apiFetch<PerfilesResponse>(`/profiles/${userId}/roles`, { method: 'PATCH', body: { role }, token }),

  quitarRol: (token: string, userId: string, role: string): Promise<PerfilesResponse> =>
    apiFetch<PerfilesResponse>(`/profiles/${userId}/roles/${encodeURIComponent(role)}`, {
      method: 'DELETE',
      token,
    }),

  crearSolicitudRol: (
    token: string,
    rolSolicitado: RolSolicitado,
  ): Promise<{ message: string; solicitud: SolicitudRolItem }> =>
    apiFetch<{ message: string; solicitud: SolicitudRolItem }>('/auth/solicitudes', {
      method: 'POST',
      body: { rolSolicitado },
      token,
    }),

  listarSolicitudesRol: (
    token: string,
    estado?: SolicitudEstado,
  ): Promise<{ solicitudes: SolicitudRolItem[] }> =>
    apiFetch<{ solicitudes: SolicitudRolItem[] }>(
      `/auth/solicitudes${estado ? `?estado=${encodeURIComponent(estado)}` : ''}`,
      { token },
    ),

  resolverSolicitudRol: (
    token: string,
    solicitudId: string,
    aprobado: boolean,
  ): Promise<{ message: string; solicitud: SolicitudRolItem }> =>
    apiFetch<{ message: string; solicitud: SolicitudRolItem }>(
      `/auth/solicitudes/${solicitudId}/resolver`,
      { method: 'POST', body: { aprobado }, token },
    ),

  updateProfile: (token: string, input: UpdateProfileInput): Promise<{ user: PublicUser }> =>
    apiFetch<{ user: PublicUser }>('/auth/me', { method: 'PATCH', token, body: input }),

  logout: (token: string): Promise<void> => apiFetch<void>('/auth/logout', { method: 'POST', token }),

  oauthAuthorize: (email: string, state: string): Promise<OAuthAuthorizeResponse> =>
    apiFetch<OAuthAuthorizeResponse>('/auth/oauth/authorize', {
      method: 'POST',
      body: { email, state },
    }),

  oauthCallback: (code: string): Promise<AuthResponse> =>
    apiFetch<AuthResponse>('/auth/oauth/callback', { method: 'POST', body: { code } }),
};
