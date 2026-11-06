---
name: finalize-workitem
description: Writes impl.md for a Work Item that add-workitem left waiting on questions, using the answers, then asks KNM to move it to finalized. Also creates the Work Item when add-workitem could not (application was ambiguous). Refuses to run while questions are unanswered.
---
<!-- knm-managed: v1 version: 2 -->
# Finalize Work Item (after Q&A answered)

Usage: `/finalize-workitem <work-item-id>` (or the REQUIREMENT id when `/add-workitem` could not create the work item yet).

All API calls go through `node .project-knm/tools/knm-api.js`; request bodies are written with the Write tool to `.knm/tmp/`, documents to their own path `docs/<folder>/<id>/<file>` (the path the API commits to; keep the file there), and both are passed with `--file` (never inline in the shell command); never call the API any other way and never read or print credentials. If the helper says to sign in, stop and tell the user to run "KNM: Sign in" in VSCode.

## Steps
1. Find out which case this is:
   `node .project-knm/tools/knm-api.js get workitem $ARGUMENTS`
   - Found: case A (work item exists), entity type `workItem`.
   - Not found: `node .project-knm/tools/knm-api.js get requirement $ARGUMENTS`. Found: case B (no work item yet), entity type `requirement`. Neither: STOP and say the id does not resolve.
2. Check the gate and read the answers (use `type=workItem` for A, `type=requirement` for B):
   `node .project-knm/tools/knm-api.js GET /api/gates --query type=<type> --query id=$ARGUMENTS`
   `node .project-knm/tools/knm-api.js GET /api/qna --query entityType=<type> --query entityId=$ARGUMENTS`
   If `gatedYn` is true: STOP and list the required questions with `answer: null`. A flagged question: report it, do not guess.
3. Re-read the context as in `/add-workitem` steps 1 to 4 (the requirement with its docs, decision, feature, blueprint, applications) with the helper. In case A the requirement id is the work item's `requirementId`; its status must still be `approved`.
4. Case B only: resolve the answer to real application ids (`GET /api/projects/<projectId>/apps`; match by name or id; no clear match: STOP and ask). Create the work item:
Write `.knm/tmp/body.json` with the Write tool:
```
{"requirementId":"$ARGUMENTS","applicationId":"APP-..","otherApplicationIds":[],"title":"...","description":"short summary"}
```
Then run:
```
node .project-knm/tools/knm-api.js POST /api/work-items --file .knm/tmp/body.json
```
   Use the returned `id` below.
5. Draft `impl.md` in memory with every answered question resolved and no placeholders. Still unresolved: STOP and say what is missing.
6. Write it (the upload sets the document link):
Write `docs/workitems/<work item id>/impl.md` with the Write tool:
```
(impl.md text)
```
Then run:
```
node .project-knm/tools/knm-api.js upload --entity-type workitem --entity-id <work item id> --key doc --file docs/workitems/<work item id>/impl.md
```
7. Request the move to finalized (skip when already `finalized`):
```
node .project-knm/tools/knm-api.js POST /api/items/<work-item-id>/transition --json '{"entity":"workitem","to":"finalized"}'
```
   If the reply has `allowed: false`, show its `reason`.
8. Report: the work item id (say if it was just created), the path, the status, and which answers shaped the plan.

## Stop and ask
- The id does not resolve, the gate is closed, or an answer is flagged or unclear.
- No application matches the answer (case B).
- 401/403 (sign in), 409, 422: show the message, do not retry blindly.
