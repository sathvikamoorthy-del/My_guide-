// POST /reports over HTTP, with the real authentication and tenant middleware and an in-memory database (REQ-169).
import { Server } from 'http';
import { authenticate } from '../../src/auth/authMiddleware';
import { signToken } from '../../src/auth/jwt';
import { createDb, Db } from '../../src/db/client';
import { migrate } from '../../src/db/migrate';
import { migrations } from '../../src/db/migrations';
import { createApp } from '../../src/http/app';
import { reportsRoute } from '../../src/reports/reportsRoute';
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
  const now = new Date().toISOString();
  for (const [table, id, tenant] of [['answers', 'ans-1', 'org-a'], ['sources', 'src-1', 'org-a'], ['answers', 'ans-b', 'org-b']]) {
    await db.execute({ sql: `INSERT INTO ${table} (id, tenant_id, created_at) VALUES (?, ?, ?)`, args: [id, tenant, now] });
  }
  for (let i = 0; i < 20; i++) await db.execute({ sql: 'INSERT INTO answers (id, tenant_id, created_at) VALUES (?, ?, ?)', args: [`many-${i}`, 'org-a', now] });
  const app = createApp({
    providers: [{ id: 'db', register: (a) => { a.set('db', db); } }],
    middleware: [{ id: 'jwt-auth', handler: authenticate as any }, { id: 'multi-tenant', handler: tenantMiddleware as any }],
    routes: [reportsRoute]
  });
  server = await new Promise<Server>((resolve) => { const s = app.listen(0, () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as any).port}`;
});

afterEach(async () => { await new Promise((r) => server.close(r)); db.close(); });

const token = (userId: string, tenantId = 'org-a') => signToken({ userId, tenantId });

async function call(method: string, path: string, opts: { body?: unknown; token?: string; raw?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetch(base + path, { method, headers, body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

const post = async (body: unknown, userId = 'user-1', tenantId = 'org-a') => call('POST', '/reports', { body, token: await token(userId, tenantId) });
const count = async () => Number((await db.execute('SELECT COUNT(*) AS n FROM reports')).rows[0].n);
const report = { targetType: 'answer', targetId: 'ans-1', problemType: 'outdated' };

describe('POST /reports', () => {
  it('rejects a request without sign-in or with a bad token (401) and stores nothing', async () => {
    // no token: the global tenant middleware (before the route) answers first, still with 401
    expect(await call('POST', '/reports', { body: report })).toEqual({ status: 401, body: { error: 'tenant-required' } });
    expect(await call('POST', '/reports', { body: report, token: 'not-a-token' })).toEqual({ status: 401, body: { error: 'unauthorized' } });
    const otherKey = await signToken({ userId: 'user-1', tenantId: 'org-a' }, { secret: 'another-secret-that-is-also-32-chars-long!' });
    expect((await call('POST', '/reports', { body: report, token: otherKey })).status).toBe(401);
    expect(await count()).toBe(0);
  });

  it('rejects a signed-in identity without a tenant (401 tenant-required)', async () => {
    const noTenant = await signToken({ userId: 'user-1' });
    expect(await call('POST', '/reports', { body: report, token: noTenant })).toEqual({ status: 401, body: { error: 'tenant-required' } });
    expect(await count()).toBe(0);
  });

  it('creates a report on an answer (201, id and status open)', async () => {
    const r = await post(report);
    expect(r).toEqual({ status: 201, body: { id: expect.any(String), status: 'open' } });
    const row = (await db.execute({ sql: 'SELECT * FROM reports WHERE id = ?', args: [r.body.id] })).rows[0];
    expect({ ...row }).toEqual({
      id: r.body.id, tenant_id: 'org-a', reporter_user_id: 'user-1', target_type: 'answer', target_id: 'ans-1',
      problem_type: 'outdated', description: null, status: 'open', created_at: expect.stringMatching(/^\d{4}-\d\d-\d\dT.*Z$/)
    });
  });

  it('creates a report on a source, with every problem type allowed', async () => {
    const r = await post({ targetType: 'source', targetId: 'src-1', problemType: 'broken-link', description: 'the portal link 404s' });
    expect(r).toEqual({ status: 201, body: { id: expect.any(String), status: 'open' } });
    for (const [i, problemType] of ['incorrect', 'missing-details', 'other'].entries()) {
      expect((await post({ targetType: 'answer', targetId: `many-${i}`, problemType, description: 'x' })).status).toBe(201);
    }
  });

  it('rejects invalid input with 400 and a message per field, storing nothing', async () => {
    const bad = await post({ targetType: 'answer-section', problemType: 'wrong', description: 5 });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('invalid-request');
    expect(Object.keys(bad.body.fields).sort()).toEqual(['description', 'problemType', 'targetId', 'targetType']);
    expect((await post({ ...report, problemType: 'other' })).body.fields).toEqual({ description: 'is required when problemType is "other"' });
    expect((await post({ ...report, description: 'x'.repeat(1001) })).status).toBe(400);
    expect((await post({ ...report, suggestedCorrection: 'y' })).body.fields).toEqual({ suggestedCorrection: 'unknown field' });
    for (const targetType of ['action-plan-item', 'public-article']) expect((await post({ ...report, targetType })).status).toBe(400);
    expect(await count()).toBe(0);
  });

  it('rejects a malformed JSON body with 400', async () => {
    const r = await call('POST', '/reports', { raw: '{"targetType":', token: await token('user-1') });
    expect(r.status).toBe(400);
    expect(await count()).toBe(0);
  });

  it('accepts a 1000-character description and an omitted description for non-"other" types', async () => {
    expect((await post({ ...report, description: 'x'.repeat(1000) })).status).toBe(201);
    expect((await post({ targetType: 'source', targetId: 'src-1', problemType: 'incorrect' })).status).toBe(201);
  });

  it('answers 404 for a target that does not exist, also when it exists in another tenant', async () => {
    expect(await post({ ...report, targetId: 'nope' })).toEqual({ status: 404, body: { error: 'target-not-found' } });
    expect(await post({ ...report, targetId: 'ans-b' })).toEqual({ status: 404, body: { error: 'target-not-found' } });
    expect(await post({ ...report, targetType: 'source' })).toEqual({ status: 404, body: { error: 'target-not-found' } });
    expect((await post({ ...report, targetId: 'ans-b' }, 'user-9', 'org-b')).status).toBe(201);   // fine in its own tenant
    expect(await count()).toBe(1);
  });

  it('lets a user report a target they were never shown, as long as it is in their tenant', async () => {
    expect((await post({ ...report, targetId: 'many-7' }, 'user-new')).status).toBe(201);
  });

  it('rejects a second open report by the same user on the same target (409 with the existing id)', async () => {
    const first = await post(report);
    const dup = await post({ ...report, problemType: 'incorrect' });
    expect(dup).toEqual({ status: 409, body: { error: 'duplicate-open-report', reportId: first.body.id } });
    expect((await post(report, 'user-2')).status).toBe(201);             // another user may still report it
    expect(await count()).toBe(2);
  });

  it('stores the report in the reporter\'s tenant only (tenant comes from the token, never the body)', async () => {
    await post({ ...report, targetId: 'ans-b' }, 'user-9', 'org-b');
    expect((await post({ ...report, tenantId: 'org-b' } as any)).status).toBe(400);
    const tenants = (await db.execute('SELECT tenant_id FROM reports')).rows.map((r) => r.tenant_id);
    expect(tenants).toEqual(['org-b']);
  });

  it('never refuses for volume: 20 reports on different targets are all accepted', async () => {
    for (let i = 0; i < 20; i++) expect((await post({ ...report, targetId: `many-${i}` })).status).toBe(201);
    expect(await count()).toBe(20);
  });

  it('offers no way to list, read, edit or delete reports', async () => {
    const { body } = await post(report);
    const t = await token('user-1');
    for (const [method, path] of [['GET', '/reports'], ['GET', `/reports/${body.id}`], ['PATCH', `/reports/${body.id}`], ['PUT', `/reports/${body.id}`], ['DELETE', `/reports/${body.id}`]]) {
      expect((await call(method, path, { token: t, body: method === 'GET' || method === 'DELETE' ? undefined : { status: 'closed' } })).status).toBe(404);
    }
    expect(await count()).toBe(1);
  });
});
