# WI-007: Reports API: POST /reports for incorrect, outdated or incomplete answers and sources

Applications: api (primary)

- **Requirement:** REQ-169: Report incorrect, outdated or incomplete answers and sources (API). Docs: `docs/requirements/REQ-169/req.md`, `docs/requirements/REQ-169/mock.md`
- **Decision / feature:** DEC-202 / FEAT-874 Incorrect Information Reporting
- **App:** `apps/api` (TypeScript, Express 4), scaffolded by SCF-0003 with jwt-auth, multi-tenant, sqlite-database, drizzle-sqlite, audit-trail, memory-cache, jest-testing and node-build

## Decisions from the Q&A

| # | Question | Answer, and what it means for the plan |
|---|---|---|
| q1 | How does the API check that the target exists? | **Add minimal `answers` and `sources` tables now**, tenant-scoped, holding an id only. The conversation feature fills them later. The 404 rule (req criteria 9 and 10) runs against these tables. |
| q2 | How is "delete a user's reports with their personal data" delivered? | **A tenant-scoped function** `deleteReportsByUser`, tested on its own and called by the data-deletion flow once that exists. No endpoint. |
| q3 | Also build the web button and dialog? | **No.** API only, so `mock.md`'s dialog is context, not scope. The web app (APP-017) is not touched. |

## Approach

### 1. Schema and migration
New migration `0001_reports`, in a new list `src/db/migrations.ts` (the database module's `migrate()` runs it; forward-only with checksums):

```sql
CREATE TABLE answers (id TEXT NOT NULL, tenant_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (tenant_id, id));
CREATE TABLE sources (id TEXT NOT NULL, tenant_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (tenant_id, id));
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  reporter_user_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('answer','source')),
  target_id TEXT NOT NULL,
  problem_type TEXT NOT NULL CHECK (problem_type IN ('incorrect','outdated','missing-details','broken-link','other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX reports_one_open_per_user_target ON reports (tenant_id, reporter_user_id, target_type, target_id) WHERE status = 'open';
CREATE INDEX reports_by_tenant_status ON reports (tenant_id, status);
```

- `answers` and `sources` hold only the id and tenant, plus a creation time, per q1. No content and no foreign keys from `reports`, because REQ-169 q9 keeps no copy of the content and the targets' lifecycle belongs to the conversation feature.
- The **partial unique index** enforces the duplicate rule (req q6) in the database, so two concurrent requests can't both create an open report. The `reports_by_tenant_status` index serves the later admin review.
- `src/db/schema.ts`: add matching Drizzle definitions (`answers`, `sources`, `reports`) next to the starter `settings` table, for typed access by later features. Reads and writes in this work item go through the tenant wrapper (below), not Drizzle directly.

### 2. Data access: `src/reports/reportsStore.ts`
Built on the multi-tenant module's `createTenantDb(asExecutor(db), { tables })`, which is the only sanctioned path for tenant tables, so every statement is scoped by `tenant_id`:
- tables: `answers: ['id']`, `sources: ['id']`, `reports: ['id','reporter_user_id','target_type','target_id','problem_type','description','status','created_at']`
- `targetExists(scope, targetType, targetId)`: selects from `answers` or `sources`, `limit 1`. A target that exists only in another tenant is therefore not found (req criterion 9).
- `findOpenReport(scope, userId, targetType, targetId)`: returns the existing open report's id, or nothing.
- `createReport(scope, input)`: inserts with a server-generated id (`crypto.randomUUID()`), `status 'open'` and `created_at` (ISO). A unique-index violation (a concurrent duplicate) becomes a `DuplicateOpenReport` error carrying the existing id (looked up again).
- `deleteReportsByUser(scope, userId)`: deletes all of the user's reports in that tenant and returns the count (q2). It's exported for the future data-deletion flow and is not reachable over HTTP.

### 3. Validation: `src/reports/validateReport.ts`
A pure function from the request body to `{ ok, value } | { ok: false, fields }`. No new dependency.
- `targetType`: required, `'answer' | 'source'`.
- `targetId`: required, non-empty string after trimming, at most 200 characters, and only `[A-Za-z0-9_-]`. The id format is the API's own choice, consistent with the tenant id rule.
- `problemType`: required, one of the five values.
- `description`: optional string, trimmed. Empty after trimming counts as missing. Required when `problemType` is `other`. At most 1000 characters after trimming (req q3, q4).
- Unknown extra fields are rejected (`fields.<name> = 'unknown field'`), so a suggested-correction field (req q5) can't slip in.
- Wrong types (number for a string, etc.) produce a message for that field. Every invalid field is reported together.

### 4. Route: `src/reports/reportsRoute.ts`
`POST /reports`, registered in the routes glue (`src/glue/routes.ts`) as `{ id: 'reports', mount }`. The handler is wrapped with `wrapAsync` from `src/http/app.ts`, because Express 4 doesn't catch rejected promises.
1. `requireAuth` (jwt-auth) → 401 `unauthorized` without a valid token. The global `tenantMiddleware` has already answered 401 `tenant-required` when the identity carries no tenant.
2. Validate → 400 `{ error: 'invalid-request', fields }`.
3. `targetExists` → 404 `{ error: 'target-not-found' }`.
4. `findOpenReport` → 409 `{ error: 'duplicate-open-report', reportId }`.
5. `createReport` → 201 `{ id, status: 'open' }`. A concurrent duplicate caught in step 5 also returns 409.

The database comes from `req.app.get('db')` (set by the database provider). No error path writes anything. There is no `GET`, `PATCH` or `DELETE` for reports (req criterion 16).

### 5. Start-up
`src/db/migrations.ts` exports the migration list, and `src/main.ts` (new) creates the database client, runs `migrate(db, migrations)`, then calls `start()` from `src/http/server.ts`. `server.ts` is unchanged, so its contract test is unaffected. A `start` script (`node dist/main.js`) is added to `apps/api/package.json` next to the existing `test` script, and a `build` script runs `node scripts/build.js`.

### 6. Existing middleware, unchanged
- **jwt-auth** identifies the caller (`req.auth.userId`, `req.auth.tenantId`).
- **multi-tenant** sets `req.tenantId` from the token. The reporter's tenant is never taken from the body.
- **audit-trail** already records every `POST` (actor, tenant, route, status).
- **memory-cache** only caches `GET`, so it doesn't affect `POST /reports`.

## Files

| File | Change |
|---|---|
| `apps/api/src/db/migrations.ts` | new: migration list with `0001_reports` |
| `apps/api/src/db/schema.ts` | add Drizzle tables `answers`, `sources`, `reports` |
| `apps/api/src/reports/validateReport.ts` | new: body validation |
| `apps/api/src/reports/reportsStore.ts` | new: tenant-scoped data access, `deleteReportsByUser` |
| `apps/api/src/reports/reportsRoute.ts` | new: `POST /reports` |
| `apps/api/src/glue/routes.ts` | register the reports route (one entry between the markers) |
| `apps/api/src/main.ts` | new: migrate, then start |
| `apps/api/package.json` | add `start` and `build` scripts |
| `apps/api/tests/reports/*.test.ts` | new: tests below |

## Tests (Jest, `npm test` in `apps/api`)
- **validateReport (unit):** every field rule, the `other` requires description rule, the 1000-character boundary (1000 accepted, 1001 rejected, whitespace trimmed first), unknown fields, several invalid fields reported together.
- **reportsStore (in-memory libSQL, migrations applied):**
  - Target found in its own tenant and not found in another.
  - Open-duplicate lookup is per user (another user may report the same target).
  - The unique index rejects a second open report.
  - `deleteReportsByUser` removes only that user's reports, in that tenant only.
- **POST /reports (HTTP):**
  - Setup: `createApp` with the real `authenticate`, `tenantMiddleware`, database provider (`:memory:`) and the reports route, on port 0, with tokens from `signToken` and `JWT_SECRET` set through `withEnv`.
  - Covers req criteria 1 to 13 and 15:
    - Responses and status codes: 401 without or with a bad token, 201 for an answer and for a source, 400 cases, 404 for a missing target and for another tenant's target, 409 with `reportId`.
    - Storage: nothing is stored on any error, and the stored row has the expected fields with no content copy.
    - Rules: a target the user never saw is accepted, another user can still report, and 20 reports on different targets are all accepted.
- **Criterion 16:** `GET`, `PATCH` and `DELETE` on `/reports` and `/reports/:id` are 404.
- **Criterion 14:** covered by the `deleteReportsByUser` tests (q2).

## Risks
- **Ids from the future conversation feature** must fit the `targetId` rule (`[A-Za-z0-9_-]`, at most 200 characters) and be written into `answers` and `sources` in the same tenant. Otherwise their reports get 404. The conversation feature must also insert those rows when it creates answers and sources.
- **Deletion depends on a caller:** criterion 14 is only met end-to-end once the data-deletion flow calls `deleteReportsByUser` for each tenant of the user.
- **Global tenant middleware:** it answers 401 `tenant-required` for every request without a tenant, including any future public route (see the SCF-0003 cohesion note). That is right for this endpoint but has to be revisited before adding login or health routes.
- **SQLite partial indexes** need SQLite 3.8+, which libSQL has. A Turso `DATABASE_URL` behaves the same.

## Assumptions
These are implementation choices; none changes the behaviour REQ-169 specifies.
- **Route and ids:** the route is `POST /reports`, as specified in req.md. Report ids are random UUIDs.
- **Status:** `status` is a plain text column. Its only value in this work item is `open`, and later statuses come from the admin features.
- **Timestamps:** `created_at` is stored as an ISO-8601 UTC string, consistent with the migrations table.
