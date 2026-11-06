import { databaseProvider, getDb } from '../../files/src/db/provider';
const fakeApp = () => { const m = new Map(); return { set: (k, v) => m.set(k, v), get: (k) => m.get(k) }; };
describe('database provider contract', () => {
    it('puts one client on the app and getDb returns it', async () => {
        process.env.DATABASE_URL = ':memory:';
        const app = fakeApp();
        const db = databaseProvider(app);
        expect(getDb(app)).toBe(db);
        expect((await db.execute('SELECT 1 AS one')).rows[0].one).toBe(1);
        delete process.env.DATABASE_URL;
    });
    it('getDb explains a missing provider', () => {
        expect(() => getDb(fakeApp())).toThrow(/provider is not registered/);
    });
});
