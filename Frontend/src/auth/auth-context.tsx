import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi, type AuthResponse, type PublicUser } from '../api/auth';

const TOKEN_KEY = 'yousac_token';

interface AuthContextValue {
  user: PublicUser | null;
  token: string | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, confirmPassword: string) => Promise<void>;
  loginWithOAuth: (email: string) => Promise<void>;
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

  async function register(email: string, password: string, confirmPassword: string): Promise<void> {
    await authApi.register(email, password, confirmPassword);
  }

  async function loginWithOAuth(email: string): Promise<void> {
    const { code } = await authApi.oauthAuthorize(email);
    saveSession(await authApi.oauthCallback(code));
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
    <AuthContext.Provider value={{ user, token, initializing, login, register, loginWithOAuth, logout }}>
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
