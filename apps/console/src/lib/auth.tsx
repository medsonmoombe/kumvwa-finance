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
  deviceToken,
  hasRefresh,
  refreshToken,
  setTokens,
  setDeviceToken,
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
  loginStage1: (email: string, password: string) => Promise<{ needs2fa: boolean; error?: string; devCode?: string }>;
  loginStage2: (code: string, rememberDevice: boolean) => Promise<string | null>;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [preToken, setPreToken] = useState<string | null>(null);

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

  const loginStage1 = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await api.post<{
          accessToken: string;
          refreshToken: string;
          stage?: '2fa';
          preToken?: string;
          devCode?: string;
        }>('/auth/console/login', { email, password }, {
          headers: deviceToken() ? { 'X-Device-Token': deviceToken() } : undefined,
        });
        if (res.data.stage === '2fa' && res.data.preToken) {
          setPreToken(res.data.preToken);
          return { needs2fa: true, devCode: res.data.devCode };
        }
        setTokens(res.data.accessToken, res.data.refreshToken);
        await refreshSession();
        return { needs2fa: false };
      } catch (e) {
        return { needs2fa: false, error: apiError(e) };
      }
    },
    [refreshSession],
  );

  const loginStage2 = useCallback(async (code: string, rememberDevice: boolean): Promise<string | null> => {
    if (!preToken) return 'Your sign-in session expired. Start again.';
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string; deviceToken?: string }>('/auth/console/verify-2fa', {
        preToken, code, rememberDevice,
      });
      setTokens(res.data.accessToken, res.data.refreshToken);
      if (res.data.deviceToken) setDeviceToken(res.data.deviceToken);
      setPreToken(null);
      await refreshSession();
      return null;
    } catch (e) {
      return apiError(e);
    }
  }, [preToken, refreshSession]);

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
    () => ({ user, tenant, loading, loginStage1, loginStage2, refreshSession, logout }),
    [user, tenant, loading, loginStage1, loginStage2, refreshSession, logout],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside an AuthProvider');
  return v;
}
