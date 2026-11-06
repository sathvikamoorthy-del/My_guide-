// SQLite / libSQL (Turso) client. One call creates the client; `asExecutor` adapts it to the `execute(sql, args)` shape the
// tenant-scoped data access of the multi-tenant module expects.
import fs from 'fs';
import path from 'path';
import { createClient, Client } from '@libsql/client';

export type Db = Client;
export interface DbOptions { url?: string; authToken?: string }

export const DEFAULT_DATABASE_URL = 'file:./data/app.db';

export function createDb(options: DbOptions = {}): Db {
  const url = (options.url ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL).trim();
  if (!/^(file:|libsql:|https?:|wss?:|:memory:)/.test(url)) throw new Error(`unsupported database URL "${url.slice(0, 40)}": use file:..., libsql://... or :memory:`);
  if (url.startsWith('file:') && !url.startsWith('file::memory:')) {
    const file = url.slice('file:'.length).split('?')[0];
    if (file) fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  return createClient({ url, authToken: options.authToken ?? process.env.DATABASE_AUTH_TOKEN });
}

export interface Executor { execute(sql: string, args: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowsAffected: number }> }
export function asExecutor(db: Db): Executor {
  return {
    async execute(sql, args) {
      const r = await db.execute({ sql, args: args as any });
      return { rows: r.rows.map((row) => ({ ...row })) as Record<string, unknown>[], rowsAffected: r.rowsAffected };
    }
  };
}
