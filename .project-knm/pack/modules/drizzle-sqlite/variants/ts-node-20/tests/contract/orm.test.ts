import { createClient } from '@libsql/client';
import { eq } from 'drizzle-orm';
import { createOrm, ormProvider } from '../../files/src/db/orm';
import { settings } from '../../files/src/db/schema';

const setup = async () => {
  const client = createClient({ url: ':memory:' });
  await client.execute('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)');
  return client;
};

describe('orm contract', () => {
  it('inserts, reads, updates and deletes through the schema', async () => {
    const orm = createOrm(await setup());
    await orm.insert(settings).values({ key: 'theme', value: 'dark', updatedAt: 1 });
    expect(await orm.select().from(settings).where(eq(settings.key, 'theme'))).toEqual([{ key: 'theme', value: 'dark', updatedAt: 1 }]);
    await orm.update(settings).set({ value: 'light', updatedAt: 2 }).where(eq(settings.key, 'theme'));
    expect((await orm.select().from(settings))[0].value).toBe('light');
    await orm.delete(settings).where(eq(settings.key, 'theme'));
    expect(await orm.select().from(settings)).toEqual([]);
  });

  it('values are bound, not interpolated, and constraints are enforced', async () => {
    const orm = createOrm(await setup());
    const evil = "x'; DROP TABLE settings; --";
    await orm.insert(settings).values({ key: evil, value: 'v', updatedAt: 1 });
    expect((await orm.select().from(settings).where(eq(settings.key, evil)))[0].key).toBe(evil);
    await expect(orm.insert(settings).values({ key: evil, value: 'again', updatedAt: 2 })).rejects.toThrow();    // primary key
    expect((await orm.select().from(settings)).length).toBe(1);                                                    // the table is still there
  });

  it('the provider builds the ORM from app.get("db") and stores it; without a database it explains', async () => {
    const store = new Map<string, unknown>([['db', await setup()]]);
    const app = { set: (k: string, v: unknown) => store.set(k, v), get: (k: string) => store.get(k) };
    const orm = ormProvider(app);
    expect(app.get('orm')).toBe(orm);
    await orm.insert(settings).values({ key: 'a', value: 'b', updatedAt: 1 });
    expect(() => ormProvider({ set: () => undefined, get: () => undefined })).toThrow(/needs the database provider/);
  });
});
