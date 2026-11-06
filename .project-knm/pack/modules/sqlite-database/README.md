# sqlite-database

Database module (STORY-053b). `createDb()` returns a libSQL client from `DATABASE_URL` (default `file:./data/app.db`, folder created; `libsql://...` for Turso with `DATABASE_AUTH_TOKEN`). `migrate(db, [{id, sql}])` applies forward-only migrations once, in order, atomically, and refuses an edited applied migration. `asExecutor(db)` gives the `execute(sql, args)` shape the multi-tenant module uses. `databaseProvider` (providers glue, outermost) stores the client as `app.get('db')`.
