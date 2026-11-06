import fs from 'fs';
import os from 'os';
import path from 'path';
import { asExecutor, createDb } from '../../files/src/db/client';
describe('database client contract', () => {
    it('creates, inserts, reads and counts rows', async () => {
        const db = createDb({ url: ':memory:' });
        await db.execute('CREATE TABLE t (a TEXT, n INTEGER)');
        const r = await db.execute({ sql: 'INSERT INTO t VALUES (?, ?)', args: ['x', 1] });
        expect(r.rowsAffected).toBe(1);
        expect((await db.execute('SELECT a, n FROM t')).rows[0]).toMatchObject({ a: 'x', n: 1 });
    });
    it('a file URL creates its folder and the data survives a new client', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knm-db-'));
        try {
            const url = `file:${path.join(dir, 'nested/deeper/app.db')}`;
            const a = createDb({ url });
            await a.execute('CREATE TABLE t (a TEXT)');
            await a.execute({ sql: 'INSERT INTO t VALUES (?)', args: ['kept'] });
            a.close();
            const b = createDb({ url });
            expect((await b.execute('SELECT a FROM t')).rows[0].a).toBe('kept');
            b.close();
        }
        finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
    it('takes the URL from DATABASE_URL, an option wins, and an unsupported URL is refused', async () => {
        const prev = process.env.DATABASE_URL;
        process.env.DATABASE_URL = ':memory:';
        try {
            const db = createDb();
            await db.execute('SELECT 1');
            expect(() => createDb({ url: 'ftp://nope' })).toThrow(/unsupported database URL/);
            expect(() => createDb({ url: '' + 'mysql://x' })).toThrow(/unsupported/);
        }
        finally {
            if (prev === undefined)
                delete process.env.DATABASE_URL;
            else
                process.env.DATABASE_URL = prev;
        }
    });
    it('asExecutor gives the execute(sql, args) shape with plain rows and the affected count', async () => {
        const db = createDb({ url: ':memory:' });
        await db.execute('CREATE TABLE t (a TEXT)');
        const ex = asExecutor(db);
        expect((await ex.execute('INSERT INTO t VALUES (?)', ['a'])).rowsAffected).toBe(1);
        const r = await ex.execute('SELECT a FROM t WHERE a = ?', ['a']);
        expect(r.rows).toEqual([{ a: 'a' }]);
        expect(Object.getPrototypeOf(r.rows[0])).toBe(Object.prototype);
        expect((await ex.execute('DELETE FROM t WHERE a = ?', ['zzz'])).rowsAffected).toBe(0);
    });
});
