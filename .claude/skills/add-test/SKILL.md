---
name: add-test
description: Draft a Test Case from an APPROVED Requirement (optionally linked to one of its Work Items) and write test-plan.md. If scenarios cannot be written without guessing, it raises Q&A questions instead; /finalize-test follows once answered.
---
<!-- knm-managed: v1 version: 2 -->
# Add Test (from an approved Requirement)

Usage: `/add-test <requirement-id> [work-item-id]`

All API calls go through `node .project-knm/tools/knm-api.js`; request bodies are written with the Write tool to `.knm/tmp/`, documents to their own path `docs/<folder>/<id>/<file>` (the path the API commits to; keep the file there), and both are passed with `--file` (never inline in the shell command); never call the API any other way and never read or print credentials. If the helper says to sign in, stop and tell the user to run "KNM: Sign in" in VSCode.

## Steps
1. Read the requirement (first argument; `$ARGUMENTS` holds both arguments):
   `node .project-knm/tools/knm-api.js get requirement <requirement-id>`
   Not found: STOP. `status` must be `approved`; otherwise STOP and say the product owner must approve it first. Note `projectId`, `createdBy`, `documentLinks`.
2. Decide the optional work item link:
   - A work item id was given: `node .project-knm/tools/knm-api.js get workitem <work-item-id>`; its `requirementId` must equal the requirement id, else STOP and report the mismatch.
   - None given: `node .project-knm/tools/knm-api.js GET /api/work-items --query requirementId=<requirement-id>`; ignore cancelled ones. Exactly one: use it. Zero or several: link none (do not guess which one).
3. Read the requirement documents if linked (`documentLinks.doc`, `documentLinks.mock-ascii`) and, if a work item is linked, its `impl.md` (`documentLinks.doc`):
   `node .project-knm/tools/knm-api.js GET /api/projects/<projectId>/docs/<path>`
   A linked work item with no `doc` yet: STOP and say `/finalize-workitem <id>` must run first.
4. Read the blueprint if `documentLinks.blueprint` is set on the project (`GET /api/projects/<projectId>`, then `GET /api/projects/<projectId>/docs/<path>`).
5. Draft in memory: a short `title` and `test-plan.md` (concrete scenarios, steps and expected outcomes derived from the acceptance criteria and the work item plan). If the requirement is too vague or contradictory to write verifiable scenarios, that is a question, not an invention.
6. Create the test case (omit `workItemId` when none is linked; description "Pending clarification - see Q&A" when there are questions):
Write `.knm/tmp/body.json` with the Write tool:
```
{"requirementId":"<requirement-id>","workItemId":"WI-..","title":"...","description":"short summary"}
```
Then run:
```
node .project-knm/tools/knm-api.js POST /api/test-cases --file .knm/tmp/body.json
```
7. No open questions: write the plan (the upload sets the document link).
Write `docs/tests/<new test id>/test-plan.md` with the Write tool:
```
(test-plan.md text)
```
Then run:
```
node .project-knm/tools/knm-api.js upload --entity-type test --entity-id <new test id> --key doc --file docs/tests/<new test id>/test-plan.md
```
   Open questions: do NOT write the plan; ask on the test case (entity type `testCase`). Types: `single_choice`, `multi_choice`, `yes_no`, `text`, `long_text`.
Write `.knm/tmp/body.json` with the Write tool:
```
{"entityType":"testCase","entityId":"<new test id>","assignedTo":"<requirement createdBy>","questions":[{"id":"q1","type":"text","text":"...","required":true,"reason":"..."}]}
```
Then run:
```
node .project-knm/tools/knm-api.js POST /api/qna/questions --file .knm/tmp/body.json
```
8. Report the test id, the linked work item (or why none), and either the path written or the questions plus "answer them in KNM, then run /finalize-test <id>". After a clean write the next step is `/finalize-test <id>`.

## Stop and ask
- Requirement not found or not approved; work item mismatch; linked work item without `impl.md`.
- Several work items and the user did not say which one matters.
- Scenarios would need guessing (raise the question).
- 401/403 (sign in), 409, 422: show the message, do not retry blindly.
