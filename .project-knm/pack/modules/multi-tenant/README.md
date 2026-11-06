# multi-tenant

Basic row-level tenant isolation for an API app (STORY-078). Shared database, every tenant table has a `tenant_id` column.

- `createTenantDb(executor, { tables })(tenantId)` returns `select / insert / update / remove`. The tenant condition is always added, values are always bound, tables and columns must be listed, and there is no raw SQL. Another tenant's id in a filter or a row is rejected (`tenant-mismatch`).
- `tenantMiddleware` sets `req.tenantId` from the authenticated identity (`req.auth.tenantId` or `req.user.tenantId`); no tenant = 401. Register it after your auth middleware (it is added to the middleware glue as `inner`). It never trusts a client header; pass `createTenantMiddleware({ resolve })` if your identity lives elsewhere.
- `executor` is `{ execute(sql, args) -> { rows, rowsAffected } }`; wrap your DB client (libSQL/Turso, better-sqlite3, ...) in one.

Out of scope: billing, metering, per-tenant scaling, compliance. Contract tests need Node >= 22.5 (they use `node:sqlite`); the module code itself runs on Node >= 18.
