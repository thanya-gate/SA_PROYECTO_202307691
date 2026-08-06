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

export const authApi = {
  login: (email: string, password: string): Promise<AuthResponse> =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),

  register: (input: RegisterInput): Promise<AuthResponse> =>
    apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: input,
    }),

  me: (token: string): Promise<MeResponse> => apiFetch<MeResponse>('/auth/me', { token }),

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
