---
name: implement-workitem
description: Implements a finalized Work Item in the repository following its plan (and the accepted preview when the project requires one), then marks it implemented in KNM. Refuses when a required preview is missing, not accepted or stale.
---
<!-- knm-managed: v1 version: 1 -->
# Implement Work Item

Usage: `/implement-workitem <work-item-id>`

All API calls go through `node .project-knm/tools/knm-api.js`; never call the API any other way and never read or print credentials. If the helper says to sign in, stop and tell the user to run "KNM: Sign in" in VSCode.

## Steps
1. Read the work item:
   `node .project-knm/tools/knm-api.js get workitem $ARGUMENTS`
   Not found: STOP. `status` `implemented`: report it and stop. `created`: STOP, `/finalize-workitem` first. `cancelled`: STOP. Only `finalized` continues.
2. Ask whether implementing is allowed:
   `node .project-knm/tools/knm-api.js GET /api/work-items/$ARGUMENTS/can-implement`
   If `allowed` is false: STOP, show `reason`, and tell the user to run `/preview-workitem $ARGUMENTS` and get it accepted in KNM (an accepted preview that went stale must be previewed again). Do not work around this.
3. Read the plan (`documentLinks.doc`):
   `node .project-knm/tools/knm-api.js GET /api/projects/<projectId>/docs/<path>`
   And the latest preview: `node .project-knm/tools/knm-api.js GET /api/work-items/$ARGUMENTS/previews`. If its state is `accepted`, stay within its file list; a file outside it needs the user's approval first.
4. Implement the plan in the repository (the work item's application folder). Follow existing conventions, run the project's own tests and fix what you broke.
5. When the work is done and verified, mark it:
```
node .project-knm/tools/knm-api.js POST /api/items/$ARGUMENTS/transition --json '{"entity":"workitem","to":"implemented"}'
```
   A reply with `allowed: false` or 409: show the message, do not retry blindly.
6. Report: files changed, test results, the new status, and any feature status change listed in the reply `changes`.

## Stop and ask
- Work item not finalized, or `can-implement` refuses.
- The plan is ambiguous, contradicts the code, or needs files outside the accepted preview.
- Tests fail and the fix is not obvious: do not mark it implemented.
- 401/403 (sign in), 409, 422: show the message.
