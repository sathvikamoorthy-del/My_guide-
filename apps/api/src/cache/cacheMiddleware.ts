import { MemoryCache } from './memoryCache';

// Caches successful JSON GET responses. The key is the caller's identity (user and tenant) plus the URL, so one user's data is
// never served to another; anonymous requests share the key "anon". Register it AFTER authentication and tenant resolution.
export interface CacheReq { method: string; originalUrl?: string; url?: string; tenantId?: string; auth?: { userId?: unknown } }
export interface CacheRes {
  statusCode: number;
  getHeader(name: string): unknown;
  setHeader(name: string, value: string): unknown;
  json(body: unknown): unknown;
}
export interface CachedBody { status: number; body: unknown }

export function cacheKey(req: CacheReq): string {
  const who = typeof req.auth?.userId === 'string' && req.auth.userId ? req.auth.userId : 'anon';
  return `${req.tenantId ?? '-'}|${who}|${req.originalUrl ?? req.url ?? ''}`;
}

export function createCacheMiddleware(cache = new MemoryCache<CachedBody>({ ttlMs: Number(process.env.CACHE_TTL_SECONDS ?? 30) * 1000 })) {
  const middleware = (req: CacheReq, res: CacheRes, next: (err?: unknown) => void) => {
    if (req.method.toUpperCase() !== 'GET') return next();
    const key = cacheKey(req);
    const hit = cache.get(key);
    if (hit) { res.setHeader('x-cache', 'hit'); res.statusCode = hit.status; res.json(hit.body); return; }
    const send = res.json.bind(res);
    res.json = (body: unknown) => {
      const noStore = /no-store|private/i.test(String(res.getHeader('cache-control') ?? '')) || res.getHeader('set-cookie') !== undefined;
      if (res.statusCode === 200 && !noStore) { cache.set(key, { status: 200, body }); res.setHeader('x-cache', 'miss'); }
      return send(body);
    };
    next();
  };
  return Object.assign(middleware, { cache });
}

// Registered in the middleware glue (after auth and tenant).
export const cacheMiddleware = createCacheMiddleware();
