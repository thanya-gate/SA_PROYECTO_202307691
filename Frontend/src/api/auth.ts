import { apiFetch } from './http';

export interface PublicUser {
  userId: string;
  email: string;
  emailVerified: boolean;
  roles: string[];
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
  redirect_uri: string;
  code: string;
}

export const authApi = {
  login: (email: string, password: string): Promise<AuthResponse> =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),

  register: (email: string, password: string, confirmPassword: string): Promise<AuthResponse> =>
    apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { email, password, confirmPassword },
    }),

  me: (token: string): Promise<MeResponse> => apiFetch<MeResponse>('/auth/me', { token }),

  logout: (token: string): Promise<void> => apiFetch<void>('/auth/logout', { method: 'POST', token }),

  oauthAuthorize: (email: string): Promise<OAuthAuthorizeResponse> =>
    apiFetch<OAuthAuthorizeResponse>('/auth/oauth/authorize', { method: 'POST', body: { email } }),

  oauthCallback: (code: string): Promise<AuthResponse> =>
    apiFetch<AuthResponse>('/auth/oauth/callback', { method: 'POST', body: { code } }),
};
