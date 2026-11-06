import { createDb } from '../../files/src/db/client';
import { migrate } from '../../files/src/db/migrate';

const m1 = { id: '001-users', sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT); CREATE INDEX users_name ON users(name)' };
const m2 = { id: '002-add-email', sql: 'ALTER TABLE users ADD COLUMN email TEXT' };

describe('migrations contract', () => {
  it('applies each migration once, in order, and is idempotent', async () => {
    const db = createDb({ url: ':memory:' });
    expect(await migrate(db, [m1, m2])).toEqual(['001-users', '002-add-email']);
    expect(await migrate(db, [m1, m2])).toEqual([]);
    expect((await db.execute('SELECT id FROM schema_migrations ORDER BY id')).rows.map((r) => r.id)).toEqual(['001-users', '002-add-email']);
    await db.execute("INSERT INTO users (name, email) VALUES ('a', 'a@x')");
  });

  it('runs only the new ones when migrations are added later', async () => {
    const db = createDb({ url: ':memory:' });
    await migrate(db, [m1]);
    expect(await migrate(db, [m1, m2])).toEqual(['002-add-email']);
  });

  it('refuses a migration that was edited after it was applied', async () => {
    const db = createDb({ url: ':memory:' });
    await migrate(db, [m1]);
    await expect(migrate(db, [{ ...m1, sql: m1.sql + '; CREATE TABLE sneaky (a TEXT)' }])).rejects.toThrow(/changed after it was applied/);
  });

  it('refuses duplicate or malformed ids before touching the database', async () => {
    const db = createDb({ url: ':memory:' });
    await expect(migrate(db, [m1, m1])).rejects.toThrow(/duplicate migration id/);
    await expect(migrate(db, [{ id: 'bad id!', sql: 'SELECT 1' }])).rejects.toThrow(/bad migration id/);
    await expect(db.execute('SELECT * FROM schema_migrations')).rejects.toThrow();
  });

  it('a failing migration leaves nothing behind (no partial table, no record) and the next run retries it', async () => {
    const db = createDb({ url: ':memory:' });
    const bad = { id: '001-bad', sql: 'CREATE TABLE ok_table (a TEXT); CREATE TABLE ok_table (a TEXT)' };
    await expect(migrate(db, [bad])).rejects.toThrow();
    expect((await db.execute("SELECT name FROM sqlite_master WHERE name = 'ok_table'")).rows).toEqual([]);
    expect((await db.execute('SELECT id FROM schema_migrations')).rows).toEqual([]);
    expect(await migrate(db, [{ id: '001-bad', sql: 'CREATE TABLE ok_table (a TEXT)' }])).toEqual(['001-bad']);
  });
});
