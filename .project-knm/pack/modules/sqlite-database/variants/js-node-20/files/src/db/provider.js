import { createDb } from './client';
export function databaseProvider(app) {
    const db = createDb();
    app.set('db', db);
    return db;
}
export function getDb(app) {
    const db = app.get('db');
    if (!db)
        throw new Error('no database: the database provider is not registered (or runs after the code that needs it)');
    return db;
}
