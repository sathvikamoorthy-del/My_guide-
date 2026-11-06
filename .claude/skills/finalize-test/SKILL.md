---
name: finalize-test
description: Writes test-plan.md for a Test Case using the answered questions (or as drafted when none), then asks KNM to move it to finalized. Refuses to run while questions are unanswered.
---
<!-- knm-managed: v1 version: 2 -->
# Finalize Test (after Q&A answered)

Usage: `/finalize-test <test-id>`

All API calls go through `node .project-knm/tools/knm-api.js`; request bodies are written with the Write tool to `.knm/tmp/`, documents to their own path `docs/<folder>/<id>/<file>` (the path the API commits to; keep the file there), and both are passed with `--file` (never inline in the shell command); never call the API any other way and never read or print credentials. If the helper says to sign in, stop and tell the user to run "KNM: Sign in" in VSCode.

## Steps
1. Read the test case:
   `node .project-knm/tools/knm-api.js get test $ARGUMENTS`
   Not found: STOP. `status` must be `created` (or `finalized`, a re-write: skip step 7). Otherwise STOP and say so. Note `requirementId`, `workItemId`, `projectId`.
2. Check the gate:
   `node .project-knm/tools/knm-api.js GET /api/gates --query type=testCase --query id=$ARGUMENTS`
   `gatedYn` true: STOP and list the required questions with `answer: null`.
3. Read the answers (`null` means none):
   `node .project-knm/tools/knm-api.js GET /api/qna --query entityType=testCase --query entityId=$ARGUMENTS`
   Answers are ground truth. A flagged question: report it, do not guess.
4. Re-read the context as in `/add-test` steps 1 to 4 with the helper: the requirement (`get requirement <requirementId>`) and its docs, the linked work item's `impl.md` if `workItemId` is set, the blueprint if linked.
5. Draft `test-plan.md` in memory: concrete scenarios, steps and expected outcomes, every answered question resolved, no placeholders. Still unresolved: STOP and say what is missing.
6. Write it (the upload sets the document link):
Write `docs/tests/$ARGUMENTS/test-plan.md` with the Write tool:
```
(test-plan.md text)
```
Then run:
```
node .project-knm/tools/knm-api.js upload --entity-type test --entity-id $ARGUMENTS --key doc --file docs/tests/$ARGUMENTS/test-plan.md
```
7. Request the move to finalized:
```
node .project-knm/tools/knm-api.js POST /api/items/$ARGUMENTS/transition --json '{"entity":"test","to":"finalized"}'
```
   If the reply has `allowed: false`, show its `reason`.
8. Report: the path, the status, and which answers shaped the plan.

## Stop and ask
- Test case not found, wrong status, closed gate, flagged or unclear answers.
- 401/403 (sign in), 409, 422: show the message, do not retry blindly.
