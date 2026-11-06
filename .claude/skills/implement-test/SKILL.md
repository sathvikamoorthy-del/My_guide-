---
name: implement-test
description: Marks a finalized Test Case as passed once its test plan has actually been run and passes. Only advances status; writes no documents.
---
<!-- knm-managed: v1 version: 1 -->
# Implement Test (mark passed)

Usage: `/implement-test <test-id>`

All API calls go through `node .project-knm/tools/knm-api.js`; never call the API any other way and never read or print credentials. If the helper says to sign in, stop and tell the user to run "KNM: Sign in" in VSCode.

## Steps
1. Read the test case:
   `node .project-knm/tools/knm-api.js get test $ARGUMENTS`
   Not found: STOP. `passed`: report it and stop. `created`: STOP, `/finalize-test` first. `cancelled`: STOP. Only `finalized` continues.
2. Read the plan (`documentLinks.doc`):
   `node .project-knm/tools/knm-api.js GET /api/projects/<projectId>/docs/<path>`
3. Run the scenarios of the plan (the project's test commands). Only if they really pass, continue. If they fail or cannot be run, STOP and report which; never mark a test passed on a guess.
4. Mark it:
```
node .project-knm/tools/knm-api.js POST /api/items/$ARGUMENTS/transition --json '{"entity":"test","to":"passed"}'
```
   A reply with `allowed: false` or 409: show the message, do not retry blindly.
5. Report the new status and any feature status change listed in the reply `changes`.

## Stop and ask
- Test not found or not finalized.
- The scenarios fail, cannot be run, or are unclear.
- 401/403 (sign in), 409, 422: show the message.
