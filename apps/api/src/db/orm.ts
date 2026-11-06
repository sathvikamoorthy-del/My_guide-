// Drizzle over the libSQL client of the database module.
import { drizzle } from 'drizzle-orm/libsql';
import type { Client } from '@libsql/client';
import * as schema from './schema';

export type Orm = ReturnType<typeof createOrm>;

export function createOrm(client: Client) {
  return drizzle(client, { schema });
}

export interface AppLike { set(key: string, value: unknown): unknown; get(key: string): unknown }

// Registered in the providers glue after the database provider: `app.get('orm')`.
export function ormProvider(app: AppLike): Orm {
  const client = app.get('db') as Client | undefined;
  if (!client) throw new Error('the ORM needs the database provider to run first (app.get("db") is empty)');
  const orm = createOrm(client);
  app.set('orm', orm);
  return orm;
}
