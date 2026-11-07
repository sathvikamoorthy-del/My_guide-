import { createDb, Db } from '../../src/db/client';
import { migrate } from '../../src/db/migrate';
import { migrations } from '../../src/db/migrations';
import { createReport, deleteReportsByUser, DuplicateOpenReport, findOpenReport, reportsStore, targetExists } from '../../src/reports/reportsStore';

const input = { targetType: 'answer' as const, targetId: 'ans-1', problemType: 'incorrect' as const, description: null };

async function setup() {
  const db = createDb({ url: ':memory:' });
  await migrate(db, migrations);
  const now = new Date().toISOString();
  await db.execute({ sql: 'INSERT INTO answers (id, tenant_id, created_at) VALUES (?, ?, ?)', args: ['ans-1', 'org-a', now] });
  await db.execute({ sql: 'INSERT INTO sources (id, tenant_id, created_at) VALUES (?, ?, ?)', args: ['src-1', 'org-a', now] });
  await db.execute({ sql: 'INSERT INTO answers (id, tenant_id, created_at) VALUES (?, ?, ?)', args: ['ans-b', 'org-b', now] });
  const forTenant = reportsStore(db);
  return { db, a: forTenant('org-a'), b: forTenant('org-b') };
}

const rows = async (db: Db) => (await db.execute('SELECT * FROM reports ORDER BY created_at, id')).rows.map((r) => ({ ...r }));

describe('reports store', () => {
  it('migration 0001_reports applies once', async () => {
    const db = createDb({ url: ':memory:' });
    expect(await migrate(db, migrations)).toEqual(['0001_reports']);
    expect(await migrate(db, migrations)).toEqual([]);
  });

  it('finds targets only in their own tenant', async () => {
    const { a, b } = await setup();
    expect(await targetExists(a, 'answer', 'ans-1')).toBe(true);
    expect(await targetExists(a, 'source', 'src-1')).toBe(true);
    expect(await targetExists(a, 'source', 'ans-1')).toBe(false);          // the type matters
    expect(await targetExists(a, 'answer', 'ans-b')).toBe(false);          // exists, but in another tenant
    expect(await targetExists(b, 'answer', 'ans-1')).toBe(false);
    expect(await targetExists(b, 'answer', 'ans-b')).toBe(true);
  });

  it('stores an open report with the reporter, target, type, description and time, and no content copy', async () => {
    const { db, a } = await setup();
    const at = new Date('2026-11-07T10:00:00.000Z');
    const created = await createReport(a, 'user-1', { ...input, problemType: 'other', description: 'wrong date' }, () => at);
    expect(created).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), status: 'open' });
    expect(await rows(db)).toEqual([{
      id: created.id, tenant_id: 'org-a', reporter_user_id: 'user-1', target_type: 'answer', target_id: 'ans-1',
      problem_type: 'other', description: 'wrong date', status: 'open', created_at: '2026-11-07T10:00:00.000Z'
    }]);
  });

  it('looks up an open duplicate per user, target and tenant', async () => {
    const { a, b } = await setup();
    const { id } = await createReport(a, 'user-1', input);
    expect(await findOpenReport(a, 'user-1', 'answer', 'ans-1')).toBe(id);
    expect(await findOpenReport(a, 'user-2', 'answer', 'ans-1')).toBeUndefined();
    expect(await findOpenReport(a, 'user-1', 'source', 'ans-1')).toBeUndefined();
    expect(await findOpenReport(b, 'user-1', 'answer', 'ans-1')).toBeUndefined();
  });

  it('the database refuses a second open report by the same user on the same target', async () => {
    const { db, a } = await setup();
    const first = await createReport(a, 'user-1', input);
    await expect(createReport(a, 'user-1', { ...input, problemType: 'outdated' })).rejects.toEqual(expect.objectContaining({ name: 'DuplicateOpenReport', reportId: first.id }));
    await expect(createReport(a, 'user-1', input)).rejects.toBeInstanceOf(DuplicateOpenReport);
    await createReport(a, 'user-2', input);                                // another user may report it
    expect((await rows(db)).length).toBe(2);
  });

  it('allows a new report once the earlier one is no longer open', async () => {
    const { db, a } = await setup();
    const first = await createReport(a, 'user-1', input);
    await db.execute({ sql: "UPDATE reports SET status = 'resolved' WHERE id = ?", args: [first.id] });   // as the admin features will
    await expect(createReport(a, 'user-1', input)).resolves.toMatchObject({ status: 'open' });
  });

  it('deleteReportsByUser removes only that user\'s reports, in that tenant only', async () => {
    const { db, a, b } = await setup();
    await createReport(a, 'user-1', input);
    await createReport(a, 'user-1', { ...input, targetType: 'source', targetId: 'src-1' });
    await createReport(a, 'user-2', input);
    await createReport(b, 'user-1', { ...input, targetId: 'ans-b' });
    expect(await deleteReportsByUser(a, 'user-1')).toBe(2);
    expect((await rows(db)).map((r) => [r.tenant_id, r.reporter_user_id])).toEqual(expect.arrayContaining([['org-a', 'user-2'], ['org-b', 'user-1']]));
    expect((await rows(db)).length).toBe(2);
    expect(await deleteReportsByUser(a, 'user-1')).toBe(0);
    await expect(deleteReportsByUser(a, '')).rejects.toThrow(/user id is required/);
  });

  it('rethrows database errors that are not duplicates', async () => {
    const { db, a } = await setup();
    await db.execute('DROP TABLE reports');
    await expect(createReport(a, 'user-1', input)).rejects.not.toBeInstanceOf(DuplicateOpenReport);
  });
});
