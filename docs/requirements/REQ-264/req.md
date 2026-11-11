# REQ-264: Free query balance API for signed-in users

- **Decision:** DEC-298
- **Feature:** FEAT-881 (Free Credit Allocation and Tracking)
- **Blueprint:** section 07, "First two free queries" and "Free-credit balance"

## Purpose

Let a signed-in user find out how many free queries they have left. Every user gets a free-query allowance that starts at two. This requirement covers recording the allowance, counting the free queries a user uses, and reading the balance through an API.

## Scope

**In scope**
- A stored free-query allowance that can be changed. Its default is **2**.
- A per-user count of free queries used.
- A read-only API that returns the caller's free-query balance.

**Out of scope**
- Charging for queries, payments and pricing.
- Bonus credits, such as the WhatsApp offer.
- Any admin screen or admin API for changing the allowance. The value only has to be stored so it can be changed later.
- Counting guest queries.

## Behaviour

### Allowance
- The free-query allowance is a stored setting. It is not hard-coded, and its default is 2 (q5).
- New users start with the full allowance.
- Users who already exist when this ships also start with the full allowance, with nothing counted as used (q2).

### What uses up a free query
- A free query is used up only when a signed-in user's query **ends with a completed action plan** (q1).
- These do **not** use up a free query: queries that remain ambiguous, queries that do not produce a completed action plan, and queries that are abandoned.
- Queries made as a guest, before signing in, never count. The count starts at sign-up and guest queries are not carried over when the person signs in (q3).
- One completed action plan uses up exactly one free query.

### Balance API
- Only a signed-in user can call it. It always returns the caller's own balance, and no parameter can select another user.
- The response has three values (q4):
  - **remaining**: free queries left, equal to `max(total allowance − used, 0)`
  - **total allowance**: the current allowance setting
  - **used**: free queries the user has used up so far
- `remaining` is never negative. If `used` reaches or goes past the allowance, for example because the allowance was later lowered, `remaining` is 0.
- Reading the balance does not change it.
- A request without sign-in is rejected with the project's standard unauthenticated response and returns no balance values.

## Acceptance criteria

1. A newly created user calling the API gets `remaining = 2`, `total allowance = 2` and `used = 0` while the default allowance is in place.
2. A user who existed before release gets `remaining = 2`, `total allowance = 2` and `used = 0` on their first call after release.
3. The API returns only the signed-in caller's balance. A user cannot read another user's balance.
4. A request without sign-in is rejected with the project's standard unauthenticated response and returns no balance.
5. After one of the user's queries ends with a completed action plan, `used` goes up by exactly 1 and `remaining` goes down by exactly 1.
6. A query that does not end with a completed action plan leaves `used` and `remaining` unchanged.
7. Queries made as a guest before sign-up are not counted in `used` after the person signs in.
8. When the user has used the whole allowance, `remaining` is 0. It is never negative, even if the allowance is later lowered below `used`.
9. Calling the API several times without completing a query returns the same values each time.
10. Changing the stored allowance setting changes `total allowance` and `remaining` for all users without a code change. No admin UI is needed to meet this criterion.

## Resolved questions

| # | Question | Answer |
|---|----------|--------|
| q1 | What event uses up one free query? | Only a query that ends with a completed action plan |
| q2 | Should existing users also start with two free queries? | Yes |
| q3 | Do guest queries count against free queries? | No, the count starts at sign-up |
| q4 | What else should the response include? | Total free allowance; number of free queries used |
| q5 | Is the allowance fixed or configurable? | Configurable value (no admin UI in this requirement) |
