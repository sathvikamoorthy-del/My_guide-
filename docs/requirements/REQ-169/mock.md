# REQ-169: Report flow (API)

```
 Signed-in user (web client)                      api: POST /reports
 ───────────────────────────                      ─────────────────────────────────────────────

 ┌──────────────────────────────────────┐
 │ Answer: "Apply at the district       │
 │ office before 31 March ..."          │
 │                                      │
 │ Sources: [1] scheme portal ↗  [⚑]    │  ⚑ = report this source
 │                          [⚑ Report]  │  ⚑ Report = report this answer
 └──────────────────────────────────────┘
                    │ click ⚑
                    ▼
 ┌──────────────────────────────────────┐
 │ What is wrong?                       │
 │ ( ) Incorrect information            │
 │ ( ) Outdated information             │
 │ ( ) Missing details                  │
 │ ( ) Broken or wrong link             │
 │ ( ) Other                            │
 │                                      │
 │ Description (required for Other)     │
 │ ┌──────────────────────────────────┐ │
 │ │                                  │ │
 │ └──────────────────────────────────┘ │
 │                         0 / 1000     │
 │              [ Cancel ]  [ Send ]    │
 └──────────────────────────────────────┘
                    │ Send
                    ▼
   { targetType, targetId, problemType, description? }
                    │
                    ▼
   ┌───────────────────────────────┐   no / invalid token
   │ authenticate (jwt-auth)       │──────────────────────▶ 401 unauthorized
   └───────────────────────────────┘
                    │
   ┌───────────────────────────────┐   no tenant on identity
   │ tenant (multi-tenant)         │──────────────────────▶ 401 tenant-required
   └───────────────────────────────┘
                    │
   ┌───────────────────────────────┐   bad type / target /
   │ validate body                 │   Other without text /
   │                               │   > 1000 chars
   └───────────────────────────────┘──────────────────────▶ 400 invalid-request {fields}
                    │
   ┌───────────────────────────────┐   not in user's tenant
   │ target exists in tenant?      │──────────────────────▶ 404 target-not-found
   └───────────────────────────────┘
                    │
   ┌───────────────────────────────┐   same user, same target,
   │ open report by this user      │   status open
   │ on this target?               │──────────────────────▶ 409 duplicate-open-report {reportId}
   └───────────────────────────────┘
                    │ no
                    ▼
   ┌───────────────────────────────┐
   │ store report (status: open)   │   tenant, reporter, target,
   │                               │   problemType, description,
   │                               │   createdAt (no content copy)
   └───────────────────────────────┘
                    │
                    ▼
            201 { id, status: "open" }
                    │
                    ▼
 ┌──────────────────────────────────────┐
 │ ✓ Thanks, your report was sent to    │   Nothing else for the reporter:
 │   the team.                          │   no list, status, edit or withdraw
 └──────────────────────────────────────┘

 Later (admin features, not in this requirement): the team reviews open reports.
 User asks for deletion of personal data ──▶ all of that user's reports are deleted.
```
