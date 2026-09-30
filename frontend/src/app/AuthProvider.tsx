import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { ApiRequestError, api } from '@/lib/http';
import type { CurrentUser } from '@/lib/types';

interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const data = await api<CurrentUser>('/auth/me');
      setUser(data);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        setUser(null);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    const data = await api<CurrentUser>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setUser(data);
    return data;
  };

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
