# drizzle-sqlite

ORM module (STORY-053b). `createOrm(client)` is Drizzle over the libSQL client of `sqlite-database`; `src/db/schema.ts` holds the app tables (a starter `settings` table to replace); `ormProvider` (providers glue, after the database provider) stores the ORM as `app.get('orm')`. Migrations stay with the database module.
