import { APP, url } from './app.ts';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

// One administrator, one password. The session token lives in localStorage (the server expires it after 7 days).
const STORAGE_KEY = 'publisher_session';

interface AuthContextValue {
  token: string | null;
  /** Returns an error message, or null on success. */
  login: (password: string) => Promise<string | null>;
  logout: () => void;
  /** (kept for the shared API client) */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const read = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  // Embedded: the session is an httpOnly cookie the browser sends by itself; there is no token here.
  const [token, setToken] = useState<string | null>(APP.embedded ? null : read());

  const store = useCallback((t: string | null) => {
    try {
      if (t) localStorage.setItem(STORAGE_KEY, t);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private window: the session lasts until the tab closes */
    }
    setToken(t);
  }, []);

  const logout = useCallback(() => {
    const t = read();
    if (t) fetch(url('/api/auth/logout'), { method: 'POST', headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
    store(null);
  }, [store]);

  const login = useCallback(
    async (password: string) => {
      try {
        const res = await fetch(url('/api/auth/login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
        const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
        if (!res.ok || !data.token) return data.error ?? 'No se pudo iniciar sesión.';
        store(data.token);
        return null;
      } catch {
        return 'No se pudo conectar con el servidor.';
      }
    },
    [store],
  );

  const value = useMemo(() => ({ token, login, logout, refresh: async () => {} }), [token, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth needs AuthProvider');
  return ctx;
}
