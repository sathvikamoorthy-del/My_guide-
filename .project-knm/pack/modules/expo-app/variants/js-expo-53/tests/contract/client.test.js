import { ApiError, createApiClient, resolveBaseUrl } from '../../files/src/api/client';
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)) });
const seq = (...rs) => {
    const f = jest.fn(async () => { const r = rs.shift(); if (r instanceof Error)
        throw r; return r; });
    return f;
};
describe('api client contract', () => {
    it('joins the base URL and path, sends the bearer token and parses JSON', async () => {
        const f = seq(reply(200, { ok: true }));
        const api = createApiClient({ baseUrl: 'http://x/', getToken: () => 'tok', fetchImpl: f });
        await expect(api.get('/api/me')).resolves.toEqual({ ok: true });
        const [url, init] = f.mock.calls[0];
        expect(url).toBe('http://x/api/me');
        expect(init.headers.Authorization).toBe('Bearer tok');
    });
    it('sends no Authorization header without a token and posts JSON', async () => {
        const f = seq(reply(201, { id: 1 }));
        const api = createApiClient({ baseUrl: 'http://x', fetchImpl: f });
        await api.post('/api/things', { a: 1 });
        const init = f.mock.calls[0][1];
        expect(init.headers.Authorization).toBeUndefined();
        expect(init.headers['Content-Type']).toBe('application/json');
        expect(init.body).toBe('{"a":1}');
    });
    it('maps an error answer to ApiError with the server message', async () => {
        const api = createApiClient({ baseUrl: 'http://x', fetchImpl: seq(reply(409, { error: 'conflict' })) });
        await expect(api.put('/api/things/1', {})).rejects.toMatchObject({ name: 'ApiError', status: 409, message: 'conflict' });
    });
    it('retries GET on a network error and on 503, with a delay, then succeeds', async () => {
        const f = seq(new Error('offline'), reply(503), reply(200, { n: 3 }));
        const api = createApiClient({ baseUrl: 'http://x', fetchImpl: f, retries: 2, retryDelayMs: 1 });
        await expect(api.get('/api/list')).resolves.toEqual({ n: 3 });
        expect(f).toHaveBeenCalledTimes(3);
    });
    it('never retries a write', async () => {
        const f = seq(reply(503), reply(200, {}));
        const api = createApiClient({ baseUrl: 'http://x', fetchImpl: f, retryDelayMs: 1 });
        await expect(api.post('/api/things', {})).rejects.toBeInstanceOf(ApiError);
        expect(f).toHaveBeenCalledTimes(1);
    });
    it('gives up with a status-0 ApiError when the network stays down', async () => {
        const api = createApiClient({ baseUrl: 'http://x', fetchImpl: seq(new Error('a'), new Error('b')), retries: 1, retryDelayMs: 1 });
        await expect(api.get('/api/list')).rejects.toMatchObject({ status: 0, message: 'Network request failed' });
    });
    it('calls onUnauthorized on a 401 and still rejects', async () => {
        const onUnauthorized = jest.fn();
        const api = createApiClient({ baseUrl: 'http://x', fetchImpl: seq(reply(401, { error: 'unauthorized' })), onUnauthorized });
        await expect(api.get('/api/me')).rejects.toMatchObject({ status: 401 });
        expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });
    it('resolves the base URL: env first, then app config, then localhost; no trailing slash', () => {
        expect(resolveBaseUrl('https://a/', 'https://b')).toBe('https://a');
        expect(resolveBaseUrl(undefined, 'https://b//')).toBe('https://b');
        expect(resolveBaseUrl(undefined, undefined, undefined, '192.168.1.5')).toBe('http://192.168.1.5:3000'); // localhost is the phone itself: use the dev machine
        expect(resolveBaseUrl('http://127.0.0.1:8787/api', undefined, undefined, '10.0.0.2')).toBe('http://10.0.0.2:8787/api');
        expect(resolveBaseUrl('https://api.example.com', undefined, undefined, '10.0.0.2')).toBe('https://api.example.com'); // a real host is never rewritten
        expect(resolveBaseUrl('http://localhost.example.com:3000', undefined, undefined, '10.0.0.2')).toBe('http://localhost.example.com:3000');
        expect(resolveBaseUrl(undefined, undefined)).toBe('http://localhost:3000');
    });
});
