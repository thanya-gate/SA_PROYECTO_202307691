import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi, type AuthResponse, type PublicUser, type RegisterInput, type UpdateProfileInput } from '../api/auth';
import { generateCodeVerifier, generateCodeChallenge, saveCodeVerifier } from '../utils/pkce';

const TOKEN_KEY = 'yousac_token';
const OAUTH_STATE_KEY = 'yousac_oauth_state';

interface AuthContextValue {
  user: PublicUser | null;
  token: string | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  loginWithOAuth: (email?: string) => Promise<void>;
  completeOAuthLogin: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<PublicUser>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [user, setUser] = useState<PublicUser | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const savedToken = readToken();
    if (!savedToken) {
      setInitializing(false);
      return;
    }
    authApi
      .me(savedToken)
      .then((res) => {
        if (active) setUser(res.user);
      })
      .catch(() => {
        if (active) {
          clearToken();
          setToken(null);
        }
      })
      .finally(() => {
        if (active) setInitializing(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function saveSession(response: AuthResponse): void {
    try {
      localStorage.setItem(TOKEN_KEY, response.accessToken);
    } catch {
    }
    setToken(response.accessToken);
    setUser(response.user);
  }

  async function login(email: string, password: string): Promise<void> {
    saveSession(await authApi.login(email, password));
  }

  async function register(input: RegisterInput): Promise<void> {
    await authApi.register(input);
  }

  // Paso 1 del flujo OAuth 2.0 (Authorization Code + PKCE):
  // Genera code_verifier + code_challenge, guarda el state y code_verifier,
  // y redirige al navegador a la URL de autorización del IdP (Google o Mock).
  async function loginWithOAuth(email?: string): Promise<void> {
    const state = crypto.randomUUID();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    try {
      sessionStorage.setItem(OAUTH_STATE_KEY, state);
    } catch {
    }
    saveCodeVerifier(codeVerifier);
    const { login_uri } = await authApi.oauthAuthorize(state, codeChallenge, email);
    window.location.assign(login_uri);
  }

  // Paso 2: el IdP redirige de vuelta al SPA con ?code=...&state=... y aquí se
  // intercambia el código por la sesión (access token + cookie).
  async function completeOAuthLogin(code: string): Promise<void> {
    const { loadCodeVerifier, clearCodeVerifier } = await import('../utils/pkce');
    const codeVerifier = loadCodeVerifier();
    saveSession(await authApi.oauthCallback(code, codeVerifier ?? undefined));
    try {
      sessionStorage.removeItem(OAUTH_STATE_KEY);
    } catch {
    }
    clearCodeVerifier();
  }

  async function logout(): Promise<void> {
    if (token) {
      try {
        await authApi.logout(token);
      } catch {
      }
    }
    clearToken();
    setToken(null);
    setUser(null);
  }

  async function refreshUser(): Promise<void> {
    if (!token) return;
    const res = await authApi.me(token);
    setUser(res.user);
  }

  async function updateProfile(input: UpdateProfileInput): Promise<PublicUser> {
    if (!token) {
      throw new Error('No autenticado');
    }
    const res = await authApi.updateProfile(token, input);
    setUser(res.user);
    return res.user;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        initializing,
        login,
        register,
        loginWithOAuth,
        completeOAuthLogin,
        logout,
        refreshUser,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
