# TC-004: POST /reports, reporting incorrect, outdated or incomplete answers and sources

- **Requirement:** REQ-169 (`docs/requirements/REQ-169/req.md`)
- **Work item:** WI-007 (`docs/workitems/WI-007/impl.md`)
- **Application:** api (`apps/api`)

## Setup

These conditions hold for every scenario unless the scenario says otherwise.

- **Environment:** `JWT_SECRET` is set to a random string of at least 32 characters.
- **Database:** in-memory libSQL (`DATABASE_URL` `:memory:` or `createDb({ url: ':memory:' })`), with migration `0001_reports` applied.
- **App:** the api app with the real `authenticate` (jwt-auth) and `tenantMiddleware` (multi-tenant), the database provider and the reports route, listening on a free port.
- **Seed data:**

  | Table | id | tenant |
  |---|---|---|
  | answers | `ans-1` | `org-a` |
  | sources | `src-1` | `org-a` |
  | answers | `ans-b` | `org-b` |
  | answers | `many-0` … `many-19` | `org-a` |

- **Tokens** come from `signToken({ userId, tenantId })`:
  - **U1**: `user-1` in `org-a`
  - **U2**: `user-2` in `org-a`
  - **U9**: `user-9` in `org-b`
- **"Nothing stored"** means the row count of `reports` is unchanged after the request.
- **Base body B:** `{ "targetType": "answer", "targetId": "ans-1", "problemType": "outdated" }`

## Scenarios

### Authentication (criterion 1)

**T1: No sign-in**
1. `POST /reports` with B and no `Authorization` header.
- Expected: `401` with `{ "error": "unauthorized" }` or `{ "error": "tenant-required" }`; either is accepted (req.md criterion 1 and API table). Nothing stored.
- Note: the implementation answers `tenant-required` here, because the global tenant middleware runs before the route.

**T2: Invalid token**
1. `POST /reports` with B and `Authorization: Bearer not-a-token`.
2. Repeat with a token signed with a different secret.
- Expected: `401 { "error": "unauthorized" }` both times. Nothing stored.

**T3: Signed in without a tenant**
1. `POST /reports` with B and a token for `user-1` that has no `tenantId`.
- Expected: `401 { "error": "tenant-required" }`. Nothing stored.

### Successful reports (criteria 2, 3, 12)

**T4: Report an answer**
1. `POST /reports` with B as U1.
- Expected:
  - `201` with `{ "id": <string>, "status": "open" }`.
  - Exactly one new row: `tenant_id` `org-a`, `reporter_user_id` `user-1`, `target_type` `answer`, `target_id` `ans-1`, `problem_type` `outdated`, `description` NULL, `status` `open`, and `created_at` an ISO-8601 UTC timestamp.
  - The row has no column holding the answer's content.

**T5: Report a source**
1. `POST /reports` as U1 with `{ "targetType": "source", "targetId": "src-1", "problemType": "broken-link", "description": "the portal link 404s" }`.
- Expected: `201`, `status` `open`. The row has `target_type` `source` and the trimmed description.

**T6: Every problem type is accepted**
1. As U1, post one report each on `many-0` … `many-4`, with `problemType` `incorrect`, `outdated`, `missing-details`, `broken-link` and `other`, each with `description: "x"`.
- Expected: all five return `201`.

### Validation (criteria 4–8)

**T7: Unknown problem type**
1. As U1, post B with `problemType` set to `wrong`, then `Outdated`, then `""`, then omitted.
- Expected: each returns `400`, `error` `invalid-request`, with a `fields.problemType` message. Nothing stored.

**T8: Disallowed target type**
1. As U1, post B with `targetType` set to `answer-section`, `action-plan-item`, `public-article`, then omitted.
- Expected: each returns `400` with `fields.targetType`. Nothing stored.

**T9: Description rules for "other"**
1. As U1, post `{ targetType: "answer", targetId: "ans-1", problemType: "other" }` with no description.
2. Repeat with `description: "   "`.
3. Repeat with `description: "wrong date"`.
- Expected:
  - Steps 1 and 2 return `400` with `fields.description` `is required when problemType is "other"`.
  - Step 3 returns `201`.

**T10: Description optional for other types**
1. As U1, post `{ targetType: "source", targetId: "src-1", problemType: "incorrect" }` with no description.
- Expected: `201`, and `description` is NULL in the row.

**T11: Description length boundary**
1. As U1, post B on `many-5` with a description of exactly 1000 characters.
2. Post B on `many-6` with 1000 characters plus 2 leading and 2 trailing spaces.
3. Post B on `many-7` with 1001 characters.
- Expected:
  - Steps 1 and 2 return `201`, and step 2 stores the trimmed 1000 characters.
  - Step 3 returns `400` with `fields.description`, and nothing is stored for `many-7`.

**T12: Malformed input**
1. As U1, post `{ targetType: "answer-section", problemType: "wrong", description: 5 }`.
2. Post the raw body `{"targetType":`.
3. Post B with `targetId: 7`.
4. Post B with `targetId: "x' OR 1=1"`.
- Expected:
  - Step 1 returns `400` with messages for `targetType`, `targetId`, `problemType` and `description`, all in one response.
  - Steps 2, 3 and 4 return `400`.
  - Nothing stored.

**T13: Unknown fields (no suggested correction, no client-chosen tenant)**
1. As U1, post B plus `suggestedCorrection: "y"`.
2. Post B plus `tenantId: "org-b"`.
- Expected: both return `400`, with `fields.suggestedCorrection` and `fields.tenantId` set to `unknown field`. Nothing stored.

### Targets and tenancy (criteria 9, 10, 13)

**T14: Target does not exist**
1. As U1, post B with `targetId: "nope"`.
2. Post B with `targetType: "source"` (no source `ans-1` exists).
- Expected: `404 { "error": "target-not-found" }` both times. Nothing stored.

**T15: Target in another tenant**
1. As U1 (`org-a`), post B with `targetId: "ans-b"`.
2. As U9 (`org-b`), post the same body.
- Expected:
  - Step 1 returns `404 target-not-found`.
  - Step 2 returns `201`, and its row has `tenant_id` `org-b`.

**T16: A target never shown to the user**
1. As a new user `user-new` in `org-a`, who has no conversations, post B with `targetId: "many-8"`.
- Expected: `201`.

**T17: Tenant comes from the token only**
1. After T15, list all `reports` rows.
- Expected: every row's `tenant_id` equals the tenant of the token that created it. No row was created in a tenant named in a request body.

### Duplicates (criterion 11)

**T18: Same user, same target, open report**
1. As U1, post B. Note the returned `id`.
2. As U1, post B again with `problemType: "incorrect"`.
3. As U2, post B.
- Expected:
  - Step 1 returns `201`.
  - Step 2 returns `409 { "error": "duplicate-open-report", "reportId": <id from step 1> }`, and nothing new is stored.
  - Step 3 returns `201`.

**T19: Re-report after the first is no longer open**
1. As U1, post B.
2. Set that report's `status` to `resolved` directly in the database, standing in for the admin features.
3. As U1, post B again.
- Expected: step 3 returns `201` with status `open`.

**T20: Concurrent duplicates**
1. As U1, send two `POST /reports` with B at the same time.
- Expected: exactly one `201` and one `409 duplicate-open-report`. Exactly one open row for (`org-a`, `user-1`, `answer`, `ans-1`). The partial unique index enforces this.

### Deletion (criterion 14, WI-007 q2)

**T21: deleteReportsByUser**
1. Create reports:
   - in `org-a`: two by `user-1` (on `ans-1` and `src-1`) and one by `user-2`;
   - in `org-b`: one by `user-1`.
2. Call `deleteReportsByUser(reportsStore(db)('org-a'), 'user-1')`.
3. Call it again.
4. Call it with `''`.
- Expected:
  - Step 2 returns `2`, leaving only the `org-a`/`user-2` and `org-b`/`user-1` rows.
  - Step 3 returns `0`.
  - Step 4 throws `a user id is required`.
- Note: end-to-end deletion depends on the future data-deletion flow calling this function for each of the user's tenants. That flow is out of scope.

### Limits and scope (criteria 15, 16)

**T22: No volume limit**
1. As U1, post B on `many-0` … `many-19` (20 requests).
- Expected: all twenty return `201`, and 20 rows are stored.

**T23: No other report endpoints**
1. As U1, after one report exists, call:
   - `GET /reports`
   - `GET /reports/<id>`
   - `PATCH /reports/<id>`
   - `PUT /reports/<id>`
   - `DELETE /reports/<id>`
- Expected: each returns `404`, and the report row is unchanged.

### Database and start-up (WI-007)

**T24: Migration**
1. Run `migrate(db, migrations)` on an empty database twice.
- Expected:
  - The first run returns `['0001_reports']` and the second returns `[]`.
  - Tables `answers`, `sources` and `reports` exist, along with indexes `reports_one_open_per_user_target` and `reports_by_tenant_status`.
  - Inserting a `reports` row with `target_type` `article`, or with `problem_type` `wrong`, fails the CHECK constraint.

**T25: Build and start**
1. In `apps/api`, run `npm run build`, then `npm start` with a file `DATABASE_URL` in a temporary folder and `PORT=0`.
- Expected:
  - The build succeeds and produces `dist/main.js`.
  - The first start logs `migrations applied: 0001_reports`, then `api listening on <port>`.
  - A second start logs no migrations.

## How to run

- **Automated:** `npm test` in `apps/api`, which runs `tests/reports/*.test.ts`.
  - T1–T19 and T21–T24 are covered by those tests. T1 accepts either error name.
- **Manual:**
  - T20 needs two parallel requests; it can also be added as an automated test.
  - T25 is a manual check.
- **Pass:** every scenario's expected outcome holds.
