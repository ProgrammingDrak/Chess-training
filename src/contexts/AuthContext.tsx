import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export interface AuthUser {
  id: number;
  username: string;
  createdAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function readApiJson<T>(res: Response, fallbackMessage: string): Promise<T> {
  const text = await res.text();
  if (!text) {
    throw new Error(res.ok ? fallbackMessage : `API unavailable (HTTP ${res.status})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`API returned an invalid response (HTTP ${res.status})`);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount (2 s timeout so UI doesn't hang in dev without a server)
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);

    fetch('/api/auth/me', { credentials: 'include', signal: controller.signal })
      .then((r) => readApiJson<{ user: AuthUser | null }>(r, 'Session unavailable'))
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => { clearTimeout(timer); setLoading(false); });

    return () => { clearTimeout(timer); controller.abort(); };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    const data = await readApiJson<{ user?: AuthUser; error?: string }>(res, 'Login failed');
    if (!res.ok) throw new Error(data.error ?? 'Login failed');
    if (!data.user) throw new Error('Login failed');
    setUser(data.user);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    const data = await readApiJson<{ user?: AuthUser; error?: string }>(res, 'Registration failed');
    if (!res.ok) throw new Error(data.error ?? 'Registration failed');
    if (!data.user) throw new Error('Registration failed');
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
