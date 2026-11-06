import { cacheKey, createCacheMiddleware } from '../../../../src/cache/cacheMiddleware';
import { MemoryCache } from '../../../../src/cache/memoryCache';

// A tiny fake of an express response: json() records the body, headers are kept.
const run = (mw: any, req: any, handler: (res: any) => void) => {
  const headers: Record<string, unknown> = {}; const out: any = { statusCode: 200, body: undefined, called: 0 };
  const res: any = { statusCode: 200, getHeader: (n: string) => headers[n.toLowerCase()], setHeader: (n: string, v: string) => { headers[n.toLowerCase()] = v; }, json(b: unknown) { out.body = b; out.status = res.statusCode; return res; } };
  mw(req, res, () => { out.called++; handler(res); });
  return { out, headers, res };
};
const get = (url: string, extra: any = {}) => ({ method: 'GET', originalUrl: url, ...extra });

describe('cache middleware contract', () => {
  it('serves a repeated GET from the cache and says so', () => {
    const mw = createCacheMiddleware(new MemoryCache({ ttlMs: 1000 }));
    let handled = 0;
    const first = run(mw, get('/items'), (res) => { handled++; res.json({ n: 1 }); });
    expect(first.headers['x-cache']).toBe('miss');
    const second = run(mw, get('/items'), (res) => { handled++; res.json({ n: 2 }); });
    expect(handled).toBe(1);
    expect(second.out.body).toEqual({ n: 1 });
    expect(second.headers['x-cache']).toBe('hit');
  });

  it('never serves one user or tenant the data of another', () => {
    const mw = createCacheMiddleware(new MemoryCache({ ttlMs: 1000 }));
    run(mw, get('/me', { auth: { userId: 'alice' }, tenantId: 't1' }), (res) => res.json({ who: 'alice' }));
    const bob = run(mw, get('/me', { auth: { userId: 'bob' }, tenantId: 't1' }), (res) => res.json({ who: 'bob' }));
    const otherTenant = run(mw, get('/me', { auth: { userId: 'alice' }, tenantId: 't2' }), (res) => res.json({ who: 'alice@t2' }));
    const anon = run(mw, get('/me'), (res) => res.json({ who: 'anon' }));
    expect(bob.out.body).toEqual({ who: 'bob' });
    expect(otherTenant.out.body).toEqual({ who: 'alice@t2' });
    expect(anon.out.body).toEqual({ who: 'anon' });
    expect(cacheKey(get('/x', { auth: { userId: 'u' }, tenantId: 't' }))).toBe('t|u|/x');
    expect(cacheKey({ method: 'GET', url: '/y' })).toBe('-|anon|/y');
  });

  it('does not cache writes, errors, no-store or cookie-setting responses, and different URLs differ', () => {
    const cache = new MemoryCache<any>({ ttlMs: 1000 });
    const mw = createCacheMiddleware(cache);
    run(mw, { method: 'POST', originalUrl: '/items' }, (res) => res.json({ ok: 1 }));
    run(mw, get('/err'), (res) => { res.statusCode = 500; res.json({ e: 1 }); });
    run(mw, get('/ns'), (res) => { res.setHeader('cache-control', 'no-store'); res.json({ s: 1 }); });
    run(mw, get('/ck'), (res) => { res.setHeader('set-cookie', 'a=b'); res.json({ c: 1 }); });
    expect(cache.stats().size).toBe(0);
    run(mw, get('/a?x=1'), (res) => res.json(1)); run(mw, get('/a?x=2'), (res) => res.json(2));
    expect(cache.stats().size).toBe(2);
  });

  it('the cache can be invalidated by prefix (e.g. after a write)', () => {
    const mw = createCacheMiddleware(new MemoryCache({ ttlMs: 1000 }));
    run(mw, get('/items', { tenantId: 't1' }), (res) => res.json([1]));
    expect(mw.cache.deletePrefix('t1|')).toBe(1);
    let handled = 0;
    run(mw, get('/items', { tenantId: 't1' }), (res) => { handled++; res.json([2]); });
    expect(handled).toBe(1);
  });
});
