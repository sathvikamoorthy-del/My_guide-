import { MemoryCache } from './memoryCache';
export function cacheKey(req) {
    const who = typeof req.auth?.userId === 'string' && req.auth.userId ? req.auth.userId : 'anon';
    return `${req.tenantId ?? '-'}|${who}|${req.originalUrl ?? req.url ?? ''}`;
}
export function createCacheMiddleware(cache = new MemoryCache({ ttlMs: Number(process.env.CACHE_TTL_SECONDS ?? 30) * 1000 })) {
    const middleware = (req, res, next) => {
        if (req.method.toUpperCase() !== 'GET')
            return next();
        const key = cacheKey(req);
        const hit = cache.get(key);
        if (hit) {
            res.setHeader('x-cache', 'hit');
            res.statusCode = hit.status;
            res.json(hit.body);
            return;
        }
        const send = res.json.bind(res);
        res.json = (body) => {
            const noStore = /no-store|private/i.test(String(res.getHeader('cache-control') ?? '')) || res.getHeader('set-cookie') !== undefined;
            if (res.statusCode === 200 && !noStore) {
                cache.set(key, { status: 200, body });
                res.setHeader('x-cache', 'miss');
            }
            return send(body);
        };
        next();
    };
    return Object.assign(middleware, { cache });
}
// Registered in the middleware glue (after auth and tenant).
export const cacheMiddleware = createCacheMiddleware();
