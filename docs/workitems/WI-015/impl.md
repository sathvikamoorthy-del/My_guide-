# WI-015: Free query balance API and usage tracking

Applications: api (primary)

- **Requirement:** REQ-264 (Free query balance API for signed-in users)
- **Decision / feature:** DEC-298 / FEAT-881

## Summary

Add a read-only endpoint that returns a signed-in user's free-query balance in the current tenant. Also add a recording function that the future conversation feature calls when a query ends with a completed action plan. The free-query allowance is one global value in the `settings` table, with a default of 2.

## Resolved questions

| # | Question | Answer | Effect on the plan |
|---|----------|--------|--------------------|
| q1 | How is a free-query use recorded? | A recording function (one use per query id, safe to call twice) that the future conversation feature calls; tests call it directly | No endpoint records a use. `recordFreeQueryUse()` is exported from the store and idempotent per query id. |
| q2 | Is the count per tenant or across tenants? | Per tenant: each tenant gives its own 2 free queries | Uses are stored in a tenant table and read through the tenant-scoped data access. The balance is for (tenant, user). |
| q3 | Where is the allowance set? | One global value in the existing `settings` table | Key `free_query_allowance` in `settings`. It is global and not tenant-scoped. When the row is missing, the default is 2. |

## Approach

### 1. Migration `0002_free_queries` (`src/db/migrations.ts`)
- `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)`. The table is defined in `schema.ts`, but no migration creates it yet. `IF NOT EXISTS` keeps the migration safe for a database that already has the table.
- New tenant table:
  ```sql
  CREATE TABLE free_query_uses (
    tenant_id TEXT NOT NULL,
    query_id  TEXT NOT NULL,
    user_id   TEXT NOT NULL,
    used_at   TEXT NOT NULL,
    PRIMARY KEY (tenant_id, query_id)
  );
  CREATE INDEX free_query_uses_by_user ON free_query_uses (tenant_id, user_id);
  ```
  The primary key on (tenant, query id) means one query can be counted at most once.
- No row is seeded for the allowance. A missing row means the default of 2.

### 2. Schema (`src/db/schema.ts`)
- Add a Drizzle definition for `freeQueryUses` that matches the migration, with the same tenant-table comment used for `reports`.

### 3. Store (`src/freeQueries/freeQueriesStore.ts`, new)
- `FREE_QUERY_TABLES = { free_query_uses: ['query_id', 'user_id', 'used_at'] }`, passed to `createTenantDb`, the same pattern as `reportsStore`.
- `DEFAULT_FREE_QUERY_ALLOWANCE = 2` and `ALLOWANCE_SETTING_KEY = 'free_query_allowance'`.
- `getAllowance(db)` reads `settings` through `asExecutor(db)` because the table is global. It returns the stored value when that value is a whole number of 0 or more. Otherwise, including when the row is missing, it returns 2.
- `countUsed(scope, userId)` counts the `free_query_uses` rows for the user in the tenant.
- `getBalance(db, scope, userId)` returns `{ remaining: max(allowance − used, 0), allowance, used }`.
- `recordFreeQueryUse(db, scope, userId, queryId, now?)`:
  - Requires a non-empty `userId` and `queryId`. Guests have no `userId`, so a guest query can never be recorded (REQ-264 q3).
  - If that query id is already recorded, it returns `{ recorded: false, reason: 'already-recorded' }` and changes nothing. A UNIQUE error from a concurrent call is handled the same way.
  - If the user has no free queries left, it returns `{ recorded: false, reason: 'no-free-queries-left' }`. `used` counts free queries only, so it never goes above the allowance in force when the use was recorded.
  - Otherwise it inserts a row and returns `{ recorded: true }`.
  - The caller, the future conversation feature, must call it only when a query **ends with a completed action plan** (REQ-264 q1). This rule is written in the function's doc comment.

### 4. Route (`src/freeQueries/freeQueriesRoute.ts`, new) and glue (`src/glue/routes.ts`)
- `GET /me/free-queries` with `requireAuth`, the same pattern as `POST /reports`.
  - No user: `401 { error: 'unauthorized' }`. No tenant: `401 { error: 'tenant-required' }`. In both cases no balance is returned.
  - Success: `200 { "remaining": 2, "allowance": 2, "used": 0 }`.
  - Every response sets `Cache-Control: no-store`. Without it, the global cache middleware would serve the balance for up to 30 seconds (`CACHE_TTL_SECONDS`), and a just-recorded use would not show (REQ-264 criteria 5 and 9).
  - The route takes no user or tenant parameter. Both come from the signed-in identity only (criterion 3).
- Register it at the `knm:entries` markers in `glue/routes.ts` with a `// WI-015 (REQ-264)` comment.

### 5. Tests (`tests/freeQueries/`, new)
- `freeQueriesStore.test.ts` uses an in-memory database with migrations applied:
  - The default allowance is 2.
  - A stored allowance is used.
  - An invalid stored value falls back to 2.
  - Recording a query increments `used`.
  - Recording the same query id twice counts once.
  - Recording is refused at 0 remaining.
  - Counts in tenant A do not affect tenant B.
  - A user cannot see another user's count.
  - Lowering the allowance below `used` gives `remaining = 0`, never a negative number.
- `freeQueriesRoute.test.ts` uses HTTP with the real auth, tenant and cache middleware, like `reportsRoute.test.ts`:
  - New user: `{2, 2, 0}`.
  - No token: 401 `unauthorized`.
  - Token without a tenant: 401 `tenant-required`.
  - After `recordFreeQueryUse`, the next GET shows the change at once (no stale cache).
  - Repeated GETs return the same values.
  - Changing the `settings` row changes `allowance` and `remaining`.

## REQ-264 acceptance mapping

| Criterion | Covered by |
|-----------|------------|
| 1 New user gets 2/2/0 | Default allowance; route test |
| 2 Existing users get 2/2/0 | Nothing is counted for anyone until uses are recorded, so existing users start at 0 used; route test |
| 3 Own balance only | Identity-only route and tenant-scoped store; store and route tests |
| 4 Unauthenticated is rejected | `requireAuth` and the tenant check; route test |
| 5 Completed plan uses one | `recordFreeQueryUse`; store and route tests |
| 6 Other outcomes use none | The caller contract (only called on a completed plan); reading never writes |
| 7 Guest queries not counted | Recording requires a user id |
| 8 Never negative | `max(…, 0)` and the refusal at 0; store test |
| 9 Reading does not change it | GET has no side effects, plus `no-store`; route test |
| 10 Allowance change applies without code change | `settings` row; route test |

## Files

- `apps/api/src/db/migrations.ts`: add `0002_free_queries`
- `apps/api/src/db/schema.ts`: add `freeQueryUses`
- `apps/api/src/freeQueries/freeQueriesStore.ts`: new
- `apps/api/src/freeQueries/freeQueriesRoute.ts`: new
- `apps/api/src/glue/routes.ts`: register the route
- `apps/api/tests/freeQueries/freeQueriesStore.test.ts`: new
- `apps/api/tests/freeQueries/freeQueriesRoute.test.ts`: new

## Risks

- **Nothing calls the recording function yet.** Until the conversation feature calls `recordFreeQueryUse`, every user's balance stays at 2. This is expected by q1, and the conversation feature's work item must include that call.
- **Concurrent recordings at the limit.** Two simultaneous recordings for different queries could both pass the "free queries left" check. `remaining` is still never negative, but `used` could go one above the allowance. This is acceptable for an API that only displays a balance. Charging (out of scope) would need a stricter check.
- **The cache header is required.** If `Cache-Control: no-store` is ever removed, the balance would be stale for up to 30 seconds. A route test checks this.
- **Deleting uses.** No delete function is added. Deleting a user's uses would give them their free queries again. Personal-data deletion should decide this separately.

## Assumptions

- The user is the JWT `userId`. There is no users table, so a user's free-query count starts from their first recorded use.
- The endpoint path `/me/free-queries` and the response field names `remaining`, `allowance` and `used` are a technical choice. They match the three values REQ-264 q4 asks for.
- An invalid stored allowance falls back to the default of 2 instead of failing the request.
