# audit-trail

Append-only audit trail (STORY-053a). `createAuditTrail({ sink }).record({ actor, action, target?, tenantId?, meta? })` writes a frozen, redacted entry (passwords, tokens, secrets, authorization, api keys, cookies at any depth) to your `AuditSink`. Oversized `meta` is replaced by a truncation marker. A failing sink is reported, never breaks the request (set `failClosed` to change that).

`auditMiddleware` records every state-changing request after the response (actor from `req.auth.userId` / `req.user.id`, tenant from `req.tenantId`). Place it after authentication. The default sink prints JSON lines; give `createAuditMiddleware(sink)` a database or log sink for production.
