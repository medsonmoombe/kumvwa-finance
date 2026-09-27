import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1';

export { API_URL };

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

/**
 * Nest returns `message` as a string, or an array from ValidationPipe. A body
 * without one — or no response at all — tells the user nothing, so every
 * branch here names what actually went wrong.
 */
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string | string[] }
      | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string' && msg.trim()) return msg;

    // No response: DNS/CORS/connection refused — never the request's fault.
    if (!err.response) {
      return `Cannot reach the API at ${API_URL}. Check that it is running, then try again.`;
    }
    const status = err.response.status;
    if (status >= 500) {
      return `The server failed to handle this request (${status}). Try again — if it keeps failing, ask an admin to check the API logs.`;
    }
    return `Request failed (${status})`;
  }
  // Thrown by our own helpers (storage PUT, file guards) — the message is the
  // reason we want to show.
  if (err instanceof Error && err.message.trim()) return err.message;
  return 'Something went wrong';
}
