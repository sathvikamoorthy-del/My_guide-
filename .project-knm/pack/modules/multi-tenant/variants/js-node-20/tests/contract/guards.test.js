import { createTenantDb, TenantError } from '../../files/src/tenancy/tenantDb';
import { createTenantMiddleware, tenantMiddleware } from '../../files/src/tenancy/tenantContext';
const calls = [];
const recorder = { async execute(sql, args) { calls.push({ sql, args }); return { rows: [], rowsAffected: 0 }; } };
const forTenant = createTenantDb(recorder, { tables: { notes: ['id', 'title'] } });
beforeEach(() => { calls.length = 0; });
describe('tenant guards contract', () => {
    it.each(['', 'a b', "x' OR '1'='1", 'a'.repeat(65), 'a/../b'])('rejects an invalid tenant id %j', (id) => {
        expect(() => forTenant(id)).toThrow(TenantError);
    });
    it('rejects a missing or non-string tenant id', () => {
        expect(() => forTenant(undefined)).toThrow(/valid tenant id/);
        expect(() => forTenant(42)).toThrow(/valid tenant id/);
    });
    it('rejects unregistered tables and columns (no injection through names)', async () => {
        const t = forTenant('t1');
        await expect(t.select('users')).rejects.toMatchObject({ code: 'unknown-table' });
        await expect(t.select('__proto__')).rejects.toMatchObject({ code: 'unknown-table' });
        await expect(t.select('notes', { 'title = 1 OR 1': 'x' })).rejects.toMatchObject({ code: 'unknown-column' });
        await expect(t.select('notes', {}, { orderBy: 'title; DROP TABLE notes' })).rejects.toMatchObject({ code: 'unknown-column' });
        expect(calls.length).toBe(0);
    });
    it('an undefined filter value is an error, not a dropped filter', async () => {
        await expect(forTenant('t1').select('notes', { title: undefined })).rejects.toMatchObject({ code: 'invalid-value' });
        await expect(forTenant('t1').select('notes', { title: { $ne: 'x' } })).rejects.toMatchObject({ code: 'invalid-value' });
    });
    it('every statement carries the tenant condition first and binds all values', async () => {
        const t = forTenant('t1');
        await t.select('notes', { title: "x' OR '1'='1" });
        await t.update('notes', { title: 'n' }, { id: 1 });
        await t.remove('notes', { id: 2 });
        await t.insert('notes', { title: 'n' });
        expect(calls[0].sql).toBe('SELECT * FROM notes WHERE tenant_id = ? AND title = ?');
        expect(calls[0].args).toEqual(['t1', "x' OR '1'='1"]);
        expect(calls[1].sql).toBe('UPDATE notes SET title = ? WHERE tenant_id = ? AND id = ?');
        expect(calls[2].sql).toBe('DELETE FROM notes WHERE tenant_id = ? AND id = ?');
        expect(calls[3].sql).toBe('INSERT INTO notes (tenant_id, title) VALUES (?, ?)');
        for (const c of calls)
            expect(c.sql).not.toContain("'");
    });
    it('validates limits, empty updates and the tenant column name', async () => {
        const t = forTenant('t1');
        await expect(t.select('notes', {}, { limit: 0 })).rejects.toMatchObject({ code: 'invalid-value' });
        await expect(t.select('notes', {}, { limit: '1; DROP' })).rejects.toMatchObject({ code: 'invalid-value' });
        await expect(t.update('notes', {}, {})).rejects.toMatchObject({ code: 'empty-update' });
        expect(() => createTenantDb(recorder, { tables: { notes: [] }, tenantColumn: 'a b' })).toThrow(TenantError);
        expect(() => createTenantDb(recorder, { tables: { 'notes; x': [] } })).toThrow(TenantError);
    });
    it('exposes no raw-query escape hatch', () => {
        expect(Object.keys(forTenant('t1')).sort()).toEqual(['insert', 'remove', 'select', 'tenantId', 'update']);
    });
});
const res = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
describe('tenant middleware contract', () => {
    it('sets req.tenantId from the authenticated identity', async () => {
        const req = { auth: { tenantId: 'acme' } };
        const next = jest.fn();
        await tenantMiddleware(req, res(), next);
        expect(req.tenantId).toBe('acme');
        expect(next).toHaveBeenCalledWith();
    });
    it('401 without a tenant, and never trusts a client header or bad ids', async () => {
        for (const req of [{}, { auth: { tenantId: 7 } }, { auth: { tenantId: 'a b' } }, { headers: { 'x-tenant-id': 'evil' } }]) {
            const r = res();
            const next = jest.fn();
            await tenantMiddleware(req, r, next);
            expect(r.code).toBe(401);
            expect(next).not.toHaveBeenCalled();
            expect(req.tenantId).toBeUndefined();
        }
    });
    it('a custom resolver is used; a throwing resolver is 403', async () => {
        const req = {};
        const next = jest.fn();
        await createTenantMiddleware({ resolve: () => 'from-resolver' })(req, res(), next);
        expect(req.tenantId).toBe('from-resolver');
        const r = res();
        await createTenantMiddleware({ resolve: () => { throw new Error('x'); } })({}, r, jest.fn());
        expect(r.code).toBe(403);
    });
});
