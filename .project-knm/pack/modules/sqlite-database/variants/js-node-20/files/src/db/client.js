// SQLite / libSQL (Turso) client. One call creates the client; `asExecutor` adapts it to the `execute(sql, args)` shape the
// tenant-scoped data access of the multi-tenant module expects.
import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';
export const DEFAULT_DATABASE_URL = 'file:./data/app.db';
export function createDb(options = {}) {
    const url = (options.url ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL).trim();
    if (!/^(file:|libsql:|https?:|wss?:|:memory:)/.test(url))
        throw new Error(`unsupported database URL "${url.slice(0, 40)}": use file:..., libsql://... or :memory:`);
    if (url.startsWith('file:') && !url.startsWith('file::memory:')) {
        const file = url.slice('file:'.length).split('?')[0];
        if (file)
            fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    }
    return createClient({ url, authToken: options.authToken ?? process.env.DATABASE_AUTH_TOKEN });
}
export function asExecutor(db) {
    return {
        async execute(sql, args) {
            const r = await db.execute({ sql, args: args });
            return { rows: r.rows.map((row) => ({ ...row })), rowsAffected: r.rowsAffected };
        }
    };
}
