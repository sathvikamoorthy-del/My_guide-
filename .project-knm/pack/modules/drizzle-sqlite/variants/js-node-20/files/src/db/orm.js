// Drizzle over the libSQL client of the database module.
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
export function createOrm(client) {
    return drizzle(client, { schema });
}
// Registered in the providers glue after the database provider: `app.get('orm')`.
export function ormProvider(app) {
    const client = app.get('db');
    if (!client)
        throw new Error('the ORM needs the database provider to run first (app.get("db") is empty)');
    const orm = createOrm(client);
    app.set('orm', orm);
    return orm;
}
