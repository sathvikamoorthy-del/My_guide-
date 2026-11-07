# REQ-169: Report incorrect, outdated or incomplete answers and sources (API)

- **Decision:** DEC-202: "Build an API where a signed-in user can report that an answer or a source is incorrect, outdated or missing details, so the team can review the report later."
- **Feature:** FEAT-874, Incorrect Information Reporting (blueprint section 05, *Knowledge quality and trust*)
- **Application:** `api` (TypeScript, Express 4)

## Purpose

Users act on My Guide's answers, so wrong or stale guidance has real consequences for them. This requirement gives a signed-in user a way to report that an answer, or a source the answer relies on, is wrong, out of date, incomplete or broken. Each report is stored so the team can review it later. The review itself belongs to the administration features (blueprint section 11, *Knowledge and source review* and *Query and outcome review*) and is not part of this requirement.

## Scope

**In scope**
- One authenticated API endpoint that creates a report.
- Validating and storing reports, scoped to the reporter's tenant.
- Rejecting a duplicate while the same user's earlier report on the same target is still open.
- Deleting a user's reports when that user's personal data is deleted.

**Out of scope**
- Any review, listing, filtering, status change or admin deletion of reports by the team (q8). The admin features cover these.
- Anything the reporter can do after submitting beyond receiving the confirmation (q7): no list of their own reports, no status view, no edit or withdraw, no notifications.
- Reports from guests (not signed in).
- Reports through WhatsApp.
- Suggested corrections from the reporter (q5).
- A copy of the reported content (q9).
- Rate limits or caps on reports (q12).

## Behaviour

### Who can report
- Only a **signed-in user**. The request must carry a valid access token, and a request without one is rejected.
- A user may report **any existing answer or source in their own tenant**. The user doesn't have to have been shown the target in their own conversations (q10).

### What can be reported (q1)
| Target type | Meaning |
|---|---|
| `answer` | A whole answer given in a conversation |
| `source` | A source reference or link cited by an answer |

Single sections of an answer, action-plan items and public articles **cannot** be reported through this API.

### Problem types (q2, plus the decision)
| Value | Meaning |
|---|---|
| `incorrect` | The information is wrong |
| `outdated` | The information is no longer current |
| `missing-details` | The answer or source leaves out details the user needed |
| `broken-link` | A link is broken or points to the wrong place |
| `other` | Another problem, described in free text |

Any problem type may be used with either target type. `missing-details` comes from DEC-202 and FEAT-874, which name it explicitly; it was added to the list chosen in q2 when this requirement was finalized.

### Description (q3, q4)
- A free-text `description` is **required when `problemType` is `other`** and optional for every other type.
- Maximum length **1000 characters**. Leading and trailing whitespace is trimmed first, and a description that is empty after trimming counts as missing.

### Duplicates (q6)
- A user who already has an **open** report (status `open`, i.e. not yet reviewed) on the same target (same target type and id) cannot submit another one. The request is rejected and nothing is stored.
- The check is per user: other users may still report the same target.
- Since this requirement has no review actions, a report stays `open` until the admin features change it. Once it is no longer open, the same user may report the same target again.

### Stored report
Each accepted report stores:
- `id`
- `tenantId`: the reporter's tenant (q11)
- `reporterUserId`: the signed-in user
- `targetType` (`answer` | `source`) and `targetId`
- `problemType`
- `description` (or none)
- `status`: always `open` on creation
- `createdAt`

No copy of the reported answer or source is stored (q9); the report refers to the target by its id only.

### Tenancy (q11)
- One tenant per organisation. A report belongs to the tenant of the signed-in user.
- A report is never visible or reachable from another tenant. A target that exists only in another tenant is treated as not found.

### Retention and deletion (q13)
- Reports are kept until an admin deletes them; the admin action belongs to the administration features.
- When a user asks for their personal data to be deleted, **all reports made by that user are deleted** as part of that request.

### Limits (q12)
- No limit on how many reports a user can submit, apart from the duplicate rule above.

## API

`POST /reports` (authenticated)

Request body:
```json
{ "targetType": "answer", "targetId": "…", "problemType": "outdated", "description": "optional, up to 1000 characters" }
```

| Outcome | Status | Body |
|---|---|---|
| Report stored | `201 Created` | `{ "id": "…", "status": "open" }` |
| No sign-in (no `Authorization` header) | `401 Unauthorized` | `{ "error": "unauthorized" }` or `{ "error": "tenant-required" }` (either is accepted) |
| Invalid sign-in (bad or expired token) | `401 Unauthorized` | `{ "error": "unauthorized" }` |
| No tenant on the signed-in identity | `401 Unauthorized` | `{ "error": "tenant-required" }` |
| Invalid input | `400 Bad Request` | `{ "error": "invalid-request", "fields": { "<field>": "<message>" } }` |
| Target not found in the user's tenant | `404 Not Found` | `{ "error": "target-not-found" }` |
| Open report by this user on this target already exists | `409 Conflict` | `{ "error": "duplicate-open-report", "reportId": "<existing id>" }` |

No error stores anything.

## Acceptance criteria

1. A request without a valid sign-in is rejected with 401 and no report is stored. With no sign-in at all, the error is `unauthorized` or `tenant-required` (either is accepted); with an invalid token it is `unauthorized`.
2. A signed-in user can report a whole answer in their tenant; the API responds 201 with the new report's id and status `open`.
3. A signed-in user can report a source reference or link in their tenant; the API responds 201 with the new report's id and status `open`.
4. `problemType` is required and must be one of `incorrect`, `outdated`, `missing-details`, `broken-link`, `other`; any other value is rejected with 400 and nothing is stored.
5. `targetType` must be `answer` or `source`; any other value (e.g. an answer section, action-plan item or public article) is rejected with 400 and nothing is stored.
6. With `problemType` `other`, a missing or blank `description` is rejected with 400; for any other problem type a report without a description is accepted.
7. A `description` longer than 1000 characters (after trimming) is rejected with 400 and nothing is stored.
8. Malformed input (missing target, wrong field types) is rejected with 400 with a message per invalid field, and nothing is stored.
9. A report naming a target that does not exist in the reporter's tenant is rejected with 404 and nothing is stored, including when the target exists in another tenant.
10. A target the user has never been shown, but which exists in their tenant, can be reported.
11. When the same user already has an `open` report on the same target, a new report is rejected with 409, names the existing report's id, and nothing is stored; a different user can still report that target.
12. A stored report records the tenant, the reporter's user id, the target type and id, the problem type, the description (if any), status `open` and the creation time, and no copy of the target's content.
13. A report is never visible from, or created in, a tenant other than the reporter's.
14. When a user's personal data is deleted on their request, every report they made is deleted too.
15. Submitting many reports on different targets is never refused for volume (no rate limit).
16. The API offers the reporter no way to list, view, edit or withdraw reports, and offers the team no review endpoints, as part of this requirement.

## Resolved questions

| # | Question | Answer |
|---|---|---|
| q1 | What can a user report? | A whole answer in a conversation; a source reference / link |
| q2 | Which problem types? | Incorrect information, Outdated information, Broken or wrong link, Other (free text). **Missing details** was added at finalization because DEC-202 names it |
| q3 | Is a description required? | Required only for "Other" |
| q4 | Maximum description length? | 1000 characters |
| q5 | Separate suggested-correction field? | No |
| q6 | Same user reports the same target again? | Rejected while their earlier report is still open |
| q7 | What can the reporter see or do afterwards? | Nothing beyond the confirmation |
| q8 | Is the team's review part of this requirement? | No |
| q9 | Keep a copy of the reported content? | No |
| q10 | Only targets shown to the user? | No |
| q11 | What is the tenant? | One tenant per organisation; a report belongs to the signed-in user's tenant and is never visible across tenants |
| q12 | Limit on reports per user? | No limit |
| q13 | Retention and deletion? | Kept until an admin deletes them; also deleted when the user asks for deletion of their personal data |
