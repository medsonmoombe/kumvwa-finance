import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1';

/**
 * Access token: memory only, so an XSS payload cannot read it off disk and it
 * dies on reload. Refresh token: localStorage for now — the hardening path is
 * an httpOnly cookie set by the API.
 */
let accessToken: string | null = null;
const REFRESH_KEY = 'kx_refresh';
const DEVICE_KEY = 'kx_trusted_device';

export function setTokens(access: string | null, refresh: string | null): void {
  accessToken = access;
  if (refresh === null) localStorage.removeItem(REFRESH_KEY);
  else localStorage.setItem(REFRESH_KEY, refresh);
}

export function refreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function hasRefresh(): boolean {
  return refreshToken() !== null;
}

export function deviceToken(): string | null {
  return localStorage.getItem(DEVICE_KEY);
}

export function setDeviceToken(token: string | null): void {
  if (token) localStorage.setItem(DEVICE_KEY, token);
  else localStorage.removeItem(DEVICE_KEY);
}

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'X-Client': 'console' },
});

api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const r = refreshToken();
  if (!r) return null;
  try {
    const res = await axios.post(
      `${API_URL}/auth/refresh`,
      { refreshToken: r },
    );
    setTokens(res.data.accessToken as string, res.data.refreshToken as string);
    return res.data.accessToken as string;
  } catch {
    setTokens(null, null);
    return null;
  }
}

/**
 * Refresh-token rotation is single-use. React StrictMode intentionally runs
 * mount effects twice in development, so both the boot sequence and 401
 * interceptor must share this one promise or the second request would look
 * like token reuse and revoke the session family.
 */
function refreshAccess(): Promise<string | null> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const original = err.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;
    const isAuthRoute = original?.url?.includes('/auth/');

    // One silent refresh-and-retry per request. Auth routes are excluded so a
    // bad password never triggers the refresh loop.
    if (
      err.response?.status === 401 &&
      original &&
      !original._retried &&
      !isAuthRoute
    ) {
      original._retried = true;
      const token = await refreshAccess();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      window.location.href = '/login';
    }
    throw err;
  },
);

/** Restores the session after a page reload. */
export async function bootRefresh(): Promise<boolean> {
  if (!hasRefresh()) return false;
  return (await refreshAccess()) !== null;
}

/** Nest returns `message` as a string, or an array from ValidationPipe. */
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string | string[] }
      | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    return 'Something went wrong';
  }
  return 'Something went wrong';
}
