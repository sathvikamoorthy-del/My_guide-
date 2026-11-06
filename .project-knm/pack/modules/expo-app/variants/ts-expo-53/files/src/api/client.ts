// Typed API client: plain fetch, bearer header, base URL, error mapping, retry of idempotent calls. No native or React imports, so it can move to a shared package.
export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) { super(message); this.name = 'ApiError'; }
}

export interface ApiClientOptions {
  baseUrl: string;
  getToken?: () => Promise<string | null> | string | null;
  fetchImpl?: typeof fetch;
  retries?: number;                      // extra attempts for GET on a network error or 502/503/504
  retryDelayMs?: number;                 // doubled on every attempt
  onUnauthorized?: () => void;           // called on a 401 (e.g. sign out)
}

const RETRY_STATUS = new Set([502, 503, 504]);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The API URL of the app: EXPO_PUBLIC_API_URL, else app.json extra.apiUrl, else localhost. Trailing slashes removed. A localhost URL is pointed at `devHost` when given. */
export function resolveBaseUrl(env: string | undefined, extra: string | undefined, fallback = 'http://localhost:3000', devHost?: string): string {
  const url = (env || extra || fallback).replace(/\/+$/, '');
  // "localhost" is the phone itself on a device: during development use the machine that serves the app (Expo's hostUri), keeping the port
  return devHost ? url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/, `$1${devHost}`) : url;
}

export function createApiClient(o: ApiClientOptions) {
  const base = o.baseUrl.replace(/\/+$/, '');
  const doFetch: typeof fetch = (input, init) => (o.fetchImpl ?? fetch)(input, init);   // looked up per call: a polyfilled or mocked fetch is honoured
  const retries = o.retries ?? 2;
  const delay = o.retryDelayMs ?? 300;

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = o.getToken ? await o.getToken() : null;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const attempts = method === 'GET' ? retries + 1 : 1;
    let last: ApiError = new ApiError(0, 'Network request failed');
    for (let i = 0; i < attempts; i++) {
      if (i) await sleep(delay * 2 ** (i - 1));
      let res: Response;
      try {
        res = await doFetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      } catch {
        last = new ApiError(0, 'Network request failed');
        continue;
      }
      const text = await res.text();
      let data: unknown = undefined;
      if (text) { try { data = JSON.parse(text); } catch { data = text; } }
      if (res.ok) return data as T;
      const msg = typeof data === 'object' && data && ('error' in data || 'message' in data) ? String((data as any).error ?? (data as any).message) : `Request failed (${res.status})`;
      last = new ApiError(res.status, msg, data);
      if (res.status === 401) o.onUnauthorized?.();
      if (!RETRY_STATUS.has(res.status)) throw last;
    }
    throw last;
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
    delete: <T>(path: string) => request<T>('DELETE', path),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
