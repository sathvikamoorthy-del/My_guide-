# TC-006: Free query balance API

- **Requirement:** REQ-264 (Free query balance API for signed-in users)
- **Work item:** WI-015 (Free query balance API and usage tracking)
- **Application:** api

## Scope

This plan verifies two things:
- `GET /me/free-queries`, which returns `{ remaining, allowance, used }`.
- The internal function `recordFreeQueryUse`.

Both are checked against REQ-264 acceptance criteria 1–10 and the WI-015 answers: free queries are counted per tenant (q2), and the allowance is one global `settings` value with a default of 2 (q3).

**Limitation:** no conversation feature exists yet, so nothing in the product can end a query with a completed action plan. A "completed action plan" is therefore simulated by calling `recordFreeQueryUse(db, scope, userId, queryId)` directly, as WI-015 q1 allows. Criteria 6 and 7 (other outcomes and guest queries are not counted) are checked at the recording-function level. They need checking again end to end once the conversation feature calls this function.

## Setup

- An in-memory SQLite database with all migrations applied (`0001_reports`, `0002_free_queries`).
- An Express app with the real middleware in production order: JWT authentication, then tenant resolution, then the memory cache. The `freeQueriesRoute` is mounted.
- Tokens are signed with `signToken({ userId, tenantId })` and a test `JWT_SECRET` of at least 32 characters.
- Default users and tenants: `user-1` and `user-2` in `org-a`, and `user-1` in `org-b`.
- No `free_query_allowance` row in `settings` unless a scenario says otherwise.

## Scenarios

| ID | Criterion | Steps | Expected result |
|----|-----------|-------|-----------------|
| S1 | 1 | GET `/me/free-queries` as `user-1` / `org-a`, with no uses recorded. | 200, `{ remaining: 2, allowance: 2, used: 0 }`, header `Cache-Control: no-store`. |
| S2 | 2 | A user who existed before release and has no recorded uses (the same state as S1) calls the API for the first time. | 200, `{ remaining: 2, allowance: 2, used: 0 }`. |
| S3 | 3 | Record `q-1` for `user-1` / `org-a`. GET as `user-2` / `org-a`. | `user-2` sees `{ 2, 2, 0 }`. The count recorded for `user-1` is not visible to `user-2`. |
| S4 | 3 | As `user-2` / `org-a`, GET `/me/free-queries?userId=user-1`. | `user-2`'s own balance. The query parameter is ignored. |
| S5 | 3, q2 | Record `q-1` and `q-2` for `user-1` / `org-a`. GET as `user-1` / `org-b`. | `org-b` balance is `{ 2, 2, 0 }`, independent of `org-a`. |
| S6 | 4 | GET with no `Authorization` header. | 401, `error` is `unauthorized` or `tenant-required` (the tenant middleware runs first), and no balance fields. |
| S7 | 4 | GET with a malformed token, or a token signed with another secret. | 401 `{ error: 'unauthorized' }`. |
| S8 | 4 | GET with a valid token that has no `tenantId`. | 401 `{ error: 'tenant-required' }`. |
| S9 | 5 | GET (2/2/0). Record `q-1`, then GET. Record `q-2`, then GET. | `{ 1, 2, 1 }`, then `{ 0, 2, 2 }`. Each read straight after a recording shows the change, with no stale cache. |
| S10 | 5 | Call `recordFreeQueryUse` twice with the same `q-1`, one after the other. Then call it twice for `q-1` at the same time. | First call: `{ recorded: true }`. Repeat: `{ recorded: false, reason: 'already-recorded' }`. `used` is 1 in both cases. |
| S11 | 6 | Read the balance several times without recording anything. | `used` and `remaining` do not change. Only the recording function changes the count. |
| S12 | 7 | Call `recordFreeQueryUse` with an empty or missing `userId`, as a guest query would have. | It throws "a user id is required". Nothing is stored, and `used` stays 0. |
| S13 | 8 | Record `q-1` and `q-2`, then record `q-3`. | `{ recorded: false, reason: 'no-free-queries-left' }`. Balance `{ 0, 2, 2 }`. Never negative. |
| S14 | 8 | Record `q-1` and `q-2`, then set the allowance to `1`. | `{ remaining: 0, allowance: 1, used: 2 }`. `remaining` is not −1. |
| S15 | 9 | Record `q-1`, then GET four times. | All four responses are identical: `{ 1, 2, 1 }`. |
| S16 | 10 | Record `q-1`, insert `free_query_allowance = '5'`, then GET. Update it to `'0'`, then GET. | `{ 4, 5, 1 }`, then `{ 0, 0, 1 }`. No restart or code change is needed. |
| S17 | 10, q3 | Store each of the invalid values `-1`, `1.5`, `two` and empty in turn. | The allowance falls back to 2 each time. |
| S18 | none | Remove `Cache-Control: no-store` from the route, run S9, then put the header back. | S9 fails. This shows that the cache header is what keeps the balance current. |

## Automated coverage

The scenarios are automated in `apps/api/tests/freeQueries/`:
- `freeQueriesRoute.test.ts`: S1–S9, S11, S15 and S16.
- `freeQueriesStore.test.ts`: S3, S5, S10, S12–S14 and S17.

S18 is a one-off check of the tests themselves. It was run during WI-015: 3 route tests failed without the header.

Run with:

```
cd apps/api
npx jest
```

## Pass criteria

- Every scenario S1–S17 gives the expected result.
- The full API suite passes with no regressions.
- The criterion 6 and 7 limitation above is accepted until the conversation feature exists.
