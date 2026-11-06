import { Db, createDb } from './client';

// Registered in the providers glue (outermost): the app gets one database client, `app.get('db')`.
export interface AppLike { set(key: string, value: unknown): unknown; get(key: string): unknown }

export function databaseProvider(app: AppLike): Db {
  const db = createDb();
  app.set('db', db);
  return db;
}

export function getDb(app: AppLike): Db {
  const db = app.get('db') as Db | undefined;
  if (!db) throw new Error('no database: the database provider is not registered (or runs after the code that needs it)');
  return db;
}
