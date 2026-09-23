import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  api,
  apiError,
  bootRefresh,
  hasRefresh,
  refreshToken,
  setTokens,
} from './api';

export type UserRole =
  | 'platform_admin'
  | 'tenant_owner'
  | 'tenant_staff'
  | 'client';

export type TenantStatus =
  | 'pending_verification'
  | 'active'
  | 'rejected'
  | 'suspended';

export interface SessionUser {
  userId: string;
  displayName: string;
  phone: string;
  role: UserRole;
}

export interface TenantBozFile {
  id: string;
  kind: string;
  mime: string;
  size: number;
  createdAt: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  type: string;
  status: TenantStatus;
  verificationNote: string | null;
  bozSubmittedAt: string | null;
  bozFile: TenantBozFile | null;
  createdAt: string;
}

interface AuthState {
  user: SessionUser | null;
  tenant: TenantInfo | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<string | null>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const me = await api.get<SessionUser>('/auth/me');
      setUser(me.data);
      // Only lenders have a tenant record; platform admins do not.
      if (me.data.role === 'tenant_owner' || me.data.role === 'tenant_staff') {
        const t = await api.get<TenantInfo>('/tenants/me');
        setTenant(t.data);
      } else {
        setTenant(null);
      }
    } catch {
      setUser(null);
      setTenant(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      if (hasRefresh() && (await bootRefresh())) await refreshSession();
      setLoading(false);
    })();
  }, [refreshSession]);

  const login = useCallback(
    async (phone: string, password: string): Promise<string | null> => {
      try {
        const res = await api.post<{
          accessToken: string;
          refreshToken: string;
        }>('/auth/login', { phone, password });
        setTokens(res.data.accessToken, res.data.refreshToken);
        await refreshSession();
        return null;
      } catch (e) {
        return apiError(e);
      }
    },
    [refreshSession],
  );

  const logout = useCallback(async () => {
    const r = refreshToken();
    try {
      if (r) await api.post('/auth/logout', { refreshToken: r });
    } catch {
      // Local teardown must happen even if the server call fails.
    } finally {
      setTokens(null, null);
      setUser(null);
      setTenant(null);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, tenant, loading, login, refreshSession, logout }),
    [user, tenant, loading, login, refreshSession, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside an AuthProvider');
  return v;
}
