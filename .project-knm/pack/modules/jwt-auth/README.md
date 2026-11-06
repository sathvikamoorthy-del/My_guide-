# jwt-auth

Authentication module (STORY-053b). `signToken` / `verifyToken` (HS256 only, expiry, optional issuer/audience; secret = `JWT_SECRET`, at least 32 characters, never stored by the scaffold). `authenticate` (middleware glue, outermost) identifies the caller: no header = anonymous, a present but bad token = 401, a valid one sets `req.auth` (`userId`, `tenantId`, `roles`). Add `requireAuth` / `requireRole(role)` to routes that need them. Missing secret fails closed (500). The tenant (multi-tenant) and audit-trail modules read `req.auth`.

## Next steps

- `JWT_SECRET` is generated for you (random, 64 characters) into the app's git-ignored `.env` when the module is applied by a scaffold plan. It is never stored in the plan, the commit or the injection record.
- Production needs its own value: set `JWT_SECRET` in the deployment environment (for example `openssl rand -hex 32`). Changing it signs everyone out.
