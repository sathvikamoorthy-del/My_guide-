// GET /me/free-queries over HTTP, with the real authentication, tenant and cache middleware and an in-memory database (REQ-264).
import { Server } from 'http';
import { authenticate } from '../../src/auth/authMiddleware';
import { signToken } from '../../src/auth/jwt';
import { createCacheMiddleware } from '../../src/cache/cacheMiddleware';
import { createDb, Db } from '../../src/db/client';
import { migrate } from '../../src/db/migrate';
import { migrations } from '../../src/db/migrations';
import { ALLOWANCE_SETTING_KEY, freeQueriesStore, recordFreeQueryUse } from '../../src/freeQueries/freeQueriesStore';
import { freeQueriesRoute } from '../../src/freeQueries/freeQueriesRoute';
import { createApp } from '../../src/http/app';
import { tenantMiddleware } from '../../src/tenancy/tenantContext';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
let db: Db;
let server: Server;
let base: string;
const savedSecret = process.env.JWT_SECRET;

beforeAll(() => { process.env.JWT_SECRET = SECRET; });
afterAll(() => { if (savedSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = savedSecret; });

beforeEach(async () => {
  db = createDb({ url: ':memory:' });
  await migrate(db, migrations);
  const app = createApp({
    providers: [{ id: 'db', register: (a) => { a.set('db', db); } }],
    middleware: [
      { id: 'jwt-auth', handler: authenticate as any },
      { id: 'multi-tenant', handler: tenantMiddleware as any },
      { id: 'memory-cache', handler: createCacheMiddleware() as any }
    ],
    routes: [freeQueriesRoute]
  });
  server = await new Promise<Server>((resolve) => { const s = app.listen(0, () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});

afterEach(async () => { await new Promise((r) => server.close(r)); db.close(); });

async function get(token?: string) {
  const res = await fetch(`${base}/me/free-queries`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined, cacheControl: res.headers.get('cache-control') };
}
const balance = async (userId = 'user-1', tenantId = 'org-a') => get(await signToken({ userId, tenantId }));
const use = (queryId: string, userId = 'user-1', tenantId = 'org-a') => recordFreeQueryUse(db, freeQueriesStore(db)(tenantId), userId, queryId);

describe('GET /me/free-queries', () => {
  it('a new signed-in user has 2 free queries left', async () => {
    expect(await balance()).toEqual({ status: 200, body: { remaining: 2, allowance: 2, used: 0 }, cacheControl: 'no-store' });
  });

  it('rejects a request without sign-in or with a bad token (401) and returns no balance', async () => {
    // the global tenant middleware runs before the route, so an anonymous call is answered "tenant-required"
    const anonymous = await get();
    expect(anonymous.status).toBe(401);
    expect(['unauthorized', 'tenant-required']).toContain(anonymous.body.error);
    expect(anonymous.body).not.toHaveProperty('remaining');
    expect(await get('not-a-token')).toMatchObject({ status: 401, body: { error: 'unauthorized' } });
  });

  it('rejects a signed-in identity without a tenant (401 tenant-required)', async () => {
    expect(await get(await signToken({ userId: 'user-1' }))).toMatchObject({ status: 401, body: { error: 'tenant-required' } });
  });

  it('shows a used free query on the very next read (never a stale cached balance)', async () => {
    expect((await balance()).body).toEqual({ remaining: 2, allowance: 2, used: 0 });
    await use('q-1');
    expect((await balance()).body).toEqual({ remaining: 1, allowance: 2, used: 1 });
    await use('q-2');
    expect((await balance()).body).toEqual({ remaining: 0, allowance: 2, used: 2 });
  });

  it('reading the balance does not change it', async () => {
    await use('q-1');
    const first = await balance();
    for (let i = 0; i < 3; i++) expect(await balance()).toEqual(first);
  });

  it('returns only the caller\'s own balance, per tenant', async () => {
    await use('q-1', 'user-1', 'org-a');
    expect((await balance('user-2', 'org-a')).body).toEqual({ remaining: 2, allowance: 2, used: 0 });
    expect((await balance('user-1', 'org-b')).body).toEqual({ remaining: 2, allowance: 2, used: 0 });
    // a query string cannot select another user
    const res = await fetch(`${base}/me/free-queries?userId=user-1`, { headers: { authorization: `Bearer ${await signToken({ userId: 'user-2', tenantId: 'org-a' })}` } });
    expect(await res.json()).toEqual({ remaining: 2, allowance: 2, used: 0 });
  });

  it('a changed allowance setting applies without a code change, and remaining never goes negative', async () => {
    await use('q-1');
    await db.execute({ sql: 'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)', args: [ALLOWANCE_SETTING_KEY, '5', Date.now()] });
    expect((await balance()).body).toEqual({ remaining: 4, allowance: 5, used: 1 });
    await db.execute({ sql: 'UPDATE settings SET value = ? WHERE key = ?', args: ['0', ALLOWANCE_SETTING_KEY] });
    expect((await balance()).body).toEqual({ remaining: 0, allowance: 0, used: 1 });
  });
});
