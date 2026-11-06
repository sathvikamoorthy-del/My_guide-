---
name: finalize-requirement
description: Writes req.md and mock.md for a Requirement (created from an approved draft) using the answered questions, then asks KNM to move it to finalized. The product owner approves next. Refuses to run while questions are unanswered.
---
<!-- knm-managed: v1 version: 2 -->
# Finalize Requirement

Usage: `/finalize-requirement <requirement-id>`

Runs after the product owner approved the draft from `/add-requirement` and the questions were answered (or there were none). All API calls go through `node .project-knm/tools/knm-api.js`; request bodies are written with the Write tool to `.knm/tmp/`, documents to their own path `docs/<folder>/<id>/<file>` (the path the API commits to; keep the file there), and both are passed with `--file` (never inline in the shell command); never call the API any other way and never read or print credentials. If the helper says to sign in, stop and tell the user to run "KNM: Sign in" in VSCode.

## Steps
1. Read the requirement:
   `node .project-knm/tools/knm-api.js get requirement $ARGUMENTS`
   Not found: STOP. `status` must be `created` (or `finalized`, a re-write: skip step 7). `approved` or `cancelled`: STOP and say so.
2. Check the gate:
   `node .project-knm/tools/knm-api.js GET /api/gates --query type=requirement --query id=$ARGUMENTS`
   If `gatedYn` is true: STOP. List the required questions that still have `answer: null` (step 3) so the user knows what blocks it.
3. Read the questions and answers (`null` means there were none):
   `node .project-knm/tools/knm-api.js GET /api/qna --query entityType=requirement --query entityId=$ARGUMENTS`
   Every answer is ground truth. An `Other` answer is in the question's `other` text. A question with a `flag` was not understood: report it, do not guess.
4. Re-read the context: the decision (`get decision <decisionId>`), its feature (`GET /api/change-requests/<featureId>`), the project (`GET /api/projects/<projectId>`) and the blueprint if `documentLinks.blueprint` is set (`GET /api/projects/<projectId>/docs/<path>`), all with the helper.
5. Draft in memory: `req.md` (full requirement in markdown: purpose, behaviour, acceptance criteria, every question resolved with its answer, no placeholders) and `mock.md` (an ASCII wireframe or flow in a code fence). If something is still unresolved, STOP and say what is missing instead of inventing it.
6. Save both (the upload also sets the document links `doc` and `mock-ascii`):
Write `docs/requirements/$ARGUMENTS/req.md` with the Write tool:
```
(req.md text)
```
Then run:
```
node .project-knm/tools/knm-api.js upload --entity-type requirement --entity-id $ARGUMENTS --key doc --file docs/requirements/$ARGUMENTS/req.md
```
Write `docs/requirements/$ARGUMENTS/mock.md` with the Write tool:
```
(mock.md text)
```
Then run:
```
node .project-knm/tools/knm-api.js upload --entity-type requirement --entity-id $ARGUMENTS --key mock-ascii --file docs/requirements/$ARGUMENTS/mock.md
```
7. Request the move to finalized (skip when already `finalized`):
```
node .project-knm/tools/knm-api.js POST /api/items/$ARGUMENTS/transition --json '{"entity":"requirement","to":"finalized"}'
```
   If the reply has `allowed: false`, show its `reason`.
8. Report: the two paths written, the new status, which answers shaped the text. Tell the user the product owner approves the requirement next (in KNM).

## Stop and ask
- Requirement not found, or status is not `created`/`finalized`.
- The gate is closed (unanswered questions) or an answer is flagged.
- Anything still ambiguous after reading the answers.
- 401/403 (sign in), 409, 422: show the message, do not retry blindly.
