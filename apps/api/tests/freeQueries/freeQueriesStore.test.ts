// Free-query data access (REQ-264 / WI-015) against an in-memory database with the real migrations.
import { createDb, Db } from '../../src/db/client';
import { migrate } from '../../src/db/migrate';
import { migrations } from '../../src/db/migrations';
import {
  ALLOWANCE_SETTING_KEY, DEFAULT_FREE_QUERY_ALLOWANCE, countUsed, freeQueriesStore, getAllowance, getBalance, recordFreeQueryUse
} from '../../src/freeQueries/freeQueriesStore';

let db: Db;
beforeEach(async () => { db = createDb({ url: ':memory:' }); await migrate(db, migrations); });
afterEach(() => db.close());

const scope = (tenant = 'org-a') => freeQueriesStore(db)(tenant);
const setAllowance = (value: string) =>
  db.execute({ sql: 'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)', args: [ALLOWANCE_SETTING_KEY, value, Date.now()] });

describe('allowance', () => {
  it('defaults to 2 when no setting is stored', async () => {
    expect(DEFAULT_FREE_QUERY_ALLOWANCE).toBe(2);
    expect(await getAllowance(db)).toBe(2);
  });

  it('uses the stored setting', async () => {
    await setAllowance('5');
    expect(await getAllowance(db)).toBe(5);
    await setAllowance('0');
    expect(await getAllowance(db)).toBe(0);
  });

  it.each(['-1', '1.5', 'two', ''])('falls back to 2 for an invalid stored value (%p)', async (value) => {
    await setAllowance(value);
    expect(await getAllowance(db)).toBe(2);
  });
});

describe('balance and recording', () => {
  it('a user with no recorded uses has the full allowance', async () => {
    expect(await getBalance(db, scope(), 'user-1')).toEqual({ remaining: 2, allowance: 2, used: 0 });
  });

  it('each recorded query uses exactly one free query', async () => {
    expect(await recordFreeQueryUse(db, scope(), 'user-1', 'q-1')).toEqual({ recorded: true });
    expect(await getBalance(db, scope(), 'user-1')).toEqual({ remaining: 1, allowance: 2, used: 1 });
    expect(await recordFreeQueryUse(db, scope(), 'user-1', 'q-2')).toEqual({ recorded: true });
    expect(await getBalance(db, scope(), 'user-1')).toEqual({ remaining: 0, allowance: 2, used: 2 });
  });

  it('recording the same query twice counts it once', async () => {
    await recordFreeQueryUse(db, scope(), 'user-1', 'q-1');
    expect(await recordFreeQueryUse(db, scope(), 'user-1', 'q-1')).toEqual({ recorded: false, reason: 'already-recorded' });
    expect(await countUsed(scope(), 'user-1')).toBe(1);
  });

  it('two concurrent calls for the same query count it once', async () => {
    const results = await Promise.all([recordFreeQueryUse(db, scope(), 'user-1', 'q-1'), recordFreeQueryUse(db, scope(), 'user-1', 'q-1')]);
    expect(results.filter((r) => r.recorded)).toHaveLength(1);
    expect(await countUsed(scope(), 'user-1')).toBe(1);
  });

  it('records nothing once no free query is left', async () => {
    await recordFreeQueryUse(db, scope(), 'user-1', 'q-1');
    await recordFreeQueryUse(db, scope(), 'user-1', 'q-2');
    expect(await recordFreeQueryUse(db, scope(), 'user-1', 'q-3')).toEqual({ recorded: false, reason: 'no-free-queries-left' });
    expect(await getBalance(db, scope(), 'user-1')).toEqual({ remaining: 0, allowance: 2, used: 2 });
  });

  it('remaining is never negative when the allowance is lowered below used', async () => {
    await recordFreeQueryUse(db, scope(), 'user-1', 'q-1');
    await recordFreeQueryUse(db, scope(), 'user-1', 'q-2');
    await setAllowance('1');
    expect(await getBalance(db, scope(), 'user-1')).toEqual({ remaining: 0, allowance: 1, used: 2 });
  });

  it('counts per user: one user cannot see or use up another user\'s free queries', async () => {
    await recordFreeQueryUse(db, scope(), 'user-1', 'q-1');
    expect(await getBalance(db, scope(), 'user-2')).toEqual({ remaining: 2, allowance: 2, used: 0 });
  });

  it('counts per tenant: each tenant gives its own free queries (WI-015 q2)', async () => {
    await recordFreeQueryUse(db, scope('org-a'), 'user-1', 'q-1');
    await recordFreeQueryUse(db, scope('org-a'), 'user-1', 'q-2');
    expect(await getBalance(db, scope('org-b'), 'user-1')).toEqual({ remaining: 2, allowance: 2, used: 0 });
    expect(await recordFreeQueryUse(db, scope('org-b'), 'user-1', 'q-1')).toEqual({ recorded: true });
  });

  it('requires a user id and a query id (a guest query cannot be recorded)', async () => {
    await expect(recordFreeQueryUse(db, scope(), '', 'q-1')).rejects.toThrow(/user id/);
    await expect(recordFreeQueryUse(db, scope(), undefined as any, 'q-1')).rejects.toThrow(/user id/);
    await expect(recordFreeQueryUse(db, scope(), 'user-1', '')).rejects.toThrow(/query id/);
    expect(await countUsed(scope(), 'user-1')).toBe(0);
  });

  it('stores the use with its time', async () => {
    await recordFreeQueryUse(db, scope(), 'user-1', 'q-1', () => new Date('2026-11-11T00:00:00.000Z'));
    const row = (await db.execute('SELECT * FROM free_query_uses')).rows[0];
    expect({ ...row }).toEqual({ tenant_id: 'org-a', query_id: 'q-1', user_id: 'user-1', used_at: '2026-11-11T00:00:00.000Z' });
  });
});
