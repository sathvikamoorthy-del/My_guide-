import { createTenantDb, Executor } from '../../../../src/tenancy/tenantDb';

// Real SQLite (node:sqlite, Node >= 22.5) behind the Executor: isolation is proven on actual query results.
const { DatabaseSync } = (process as any).getBuiltinModule('node:sqlite');
function sqlite(): Executor {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, tenant_id TEXT NOT NULL, title TEXT, done INTEGER, owner TEXT)');
  return {
    async execute(sql, args) {
      const st = db.prepare(sql);
      if (/^\s*select/i.test(sql)) return { rows: st.all(...args).map((r: any) => ({ ...r })), rowsAffected: 0 };
      return { rows: [], rowsAffected: Number(st.run(...args).changes) };
    }
  };
}

const setup = async () => {
  const forTenant = createTenantDb(sqlite(), { tables: { notes: ['id', 'title', 'done', 'owner'] } });
  const a = forTenant('tenant-a');
  const b = forTenant('tenant-b');
  await a.insert('notes', { title: 'a1', done: false });
  await a.insert('notes', { title: 'a2', done: true });
  await b.insert('notes', { title: 'b1', done: false });
  return { a, b, forTenant };
};

describe('tenant isolation contract', () => {
  it('a tenant reads only its own rows', async () => {
    const { a, b } = await setup();
    expect((await a.select('notes')).map((r) => r.title).sort()).toEqual(['a1', 'a2']);
    expect((await b.select('notes')).map((r) => r.title)).toEqual(['b1']);
  });

  it('cannot read another tenant by filtering on its row id or tenant column', async () => {
    const { a, b } = await setup();
    const bRow = (await b.select('notes'))[0];
    expect(await a.select('notes', { id: bRow.id as number })).toEqual([]);
    await expect(a.select('notes', { tenant_id: 'tenant-b' })).rejects.toMatchObject({ code: 'tenant-mismatch' });
  });

  it('cannot update or delete another tenant rows (zero rows touched)', async () => {
    const { a, b } = await setup();
    const bRow = (await b.select('notes'))[0];
    expect(await a.update('notes', { title: 'hacked' }, { id: bRow.id as number })).toBe(0);
    expect(await a.remove('notes', { id: bRow.id as number })).toBe(0);
    expect((await b.select('notes'))[0].title).toBe('b1');
  });

  it('insert is always stamped with the caller tenant; writing for another tenant is refused', async () => {
    const { a, b } = await setup();
    await expect(a.insert('notes', { title: 'x', tenant_id: 'tenant-b' })).rejects.toMatchObject({ code: 'tenant-mismatch' });
    await a.insert('notes', { title: 'mine', tenant_id: 'tenant-a' });
    expect((await b.select('notes', { title: 'mine' })).length).toBe(0);
    expect((await a.select('notes', { title: 'mine' })).length).toBe(1);
  });

  it('a row cannot be moved to another tenant', async () => {
    const { a } = await setup();
    await expect(a.update('notes', { tenant_id: 'tenant-b' }, { title: 'a1' })).rejects.toMatchObject({ code: 'tenant-mismatch' });
  });

  it('update and delete without other filters still stay inside the tenant', async () => {
    const { a, b } = await setup();
    expect(await a.update('notes', { done: true }, {})).toBe(2);
    expect(await a.remove('notes', {})).toBe(2);
    expect((await b.select('notes')).length).toBe(1);
  });

  it('supports null filters, ordering and limits inside the tenant', async () => {
    const { a } = await setup();
    await a.insert('notes', { title: 'a3', owner: null });
    expect((await a.select('notes', { owner: null })).length).toBe(3);
    expect((await a.select('notes', {}, { orderBy: 'title', desc: true, limit: 1 }))[0].title).toBe('a3');
  });
});
