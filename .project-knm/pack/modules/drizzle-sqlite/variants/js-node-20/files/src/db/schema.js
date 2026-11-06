// The app's tables, as Drizzle definitions. This starter has one generic table; replace it with the app's own schema
// (migrations stay with the database module: write the matching SQL there).
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const settings = sqliteTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    updatedAt: integer('updated_at').notNull()
});
