import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi, type AuthResponse, type PublicUser, type RegisterInput } from '../api/auth';

const TOKEN_KEY = 'yousac_token';
const OAUTH_STATE_KEY = 'yousac_oauth_state';

interface AuthContextValue {
  user: PublicUser | null;
  token: string | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  loginWithOAuth: (email: string) => Promise<void>;
  completeOAuthLogin: (code: string) => Promise<void>;
  logout: () => Promise<void>;
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

  // Paso 1 del flujo OAuth 2.0 (Authorization Code): pide la URL de autorización
  // del IdP y redirige el navegador a la pantalla institucional.
  async function loginWithOAuth(email: string): Promise<void> {
    const state = crypto.randomUUID();
    try {
      sessionStorage.setItem(OAUTH_STATE_KEY, state);
    } catch {
    }
    const { login_uri } = await authApi.oauthAuthorize(email, state);
    window.location.assign(login_uri);
  }

  // Paso 2: el IdP redirige de vuelta al SPA con ?code=...&state=... y aquí se
  // intercambia el código por la sesión (access token + cookie).
  async function completeOAuthLogin(code: string): Promise<void> {
    saveSession(await authApi.oauthCallback(code));
    try {
      sessionStorage.removeItem(OAUTH_STATE_KEY);
    } catch {
    }
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

  return (
    <AuthContext.Provider
      value={{ user, token, initializing, login, register, loginWithOAuth, completeOAuthLogin, logout }}
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
