// Typed API client: plain fetch, bearer header, base URL, error mapping, retry of idempotent calls. No native or React imports, so it can move to a shared package.
export class ApiError extends Error {
    constructor(status, message, body) {
        super(message);
        this.status = status;
        this.body = body;
        this.name = 'ApiError';
    }
}
const RETRY_STATUS = new Set([502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** The API URL of the app: EXPO_PUBLIC_API_URL, else app.json extra.apiUrl, else localhost. Trailing slashes removed. A localhost URL is pointed at `devHost` when given. */
export function resolveBaseUrl(env, extra, fallback = 'http://localhost:3000', devHost) {
    const url = (env || extra || fallback).replace(/\/+$/, '');
    // "localhost" is the phone itself on a device: during development use the machine that serves the app (Expo's hostUri), keeping the port
    return devHost ? url.replace(/^(https?:\/\/)(localhost|127\.0\.0\.1)(?=[:/]|$)/, `$1${devHost}`) : url;
}
export function createApiClient(o) {
    const base = o.baseUrl.replace(/\/+$/, '');
    const doFetch = (input, init) => (o.fetchImpl ?? fetch)(input, init); // looked up per call: a polyfilled or mocked fetch is honoured
    const retries = o.retries ?? 2;
    const delay = o.retryDelayMs ?? 300;
    async function request(method, path, body) {
        const token = o.getToken ? await o.getToken() : null;
        const headers = { Accept: 'application/json' };
        if (body !== undefined)
            headers['Content-Type'] = 'application/json';
        if (token)
            headers.Authorization = `Bearer ${token}`;
        const attempts = method === 'GET' ? retries + 1 : 1;
        let last = new ApiError(0, 'Network request failed');
        for (let i = 0; i < attempts; i++) {
            if (i)
                await sleep(delay * 2 ** (i - 1));
            let res;
            try {
                res = await doFetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
            }
            catch {
                last = new ApiError(0, 'Network request failed');
                continue;
            }
            const text = await res.text();
            let data = undefined;
            if (text) {
                try {
                    data = JSON.parse(text);
                }
                catch {
                    data = text;
                }
            }
            if (res.ok)
                return data;
            const msg = typeof data === 'object' && data && ('error' in data || 'message' in data) ? String(data.error ?? data.message) : `Request failed (${res.status})`;
            last = new ApiError(res.status, msg, data);
            if (res.status === 401)
                o.onUnauthorized?.();
            if (!RETRY_STATUS.has(res.status))
                throw last;
        }
        throw last;
    }
    return {
        get: (path) => request('GET', path),
        post: (path, body) => request('POST', path, body ?? {}),
        put: (path, body) => request('PUT', path, body ?? {}),
        patch: (path, body) => request('PATCH', path, body ?? {}),
        delete: (path) => request('DELETE', path),
    };
}
