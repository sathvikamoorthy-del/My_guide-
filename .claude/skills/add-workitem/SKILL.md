---
name: add-workitem
description: Draft a Work Item from an APPROVED Requirement (primary application plus other applications) and write impl.md. If anything is unclear, including which application it belongs to, it raises a Q&A question instead of guessing; /finalize-workitem follows once answered.
---
<!-- knm-managed: v1 version: 2 -->
# Add Work Item (from an approved Requirement)

Usage: `/add-workitem <requirement-id>`

All API calls go through `node .project-knm/tools/knm-api.js`; request bodies are written with the Write tool to `.knm/tmp/`, documents to their own path `docs/<folder>/<id>/<file>` (the path the API commits to; keep the file there), and both are passed with `--file` (never inline in the shell command); never call the API any other way and never read or print credentials. If the helper says to sign in, stop and tell the user to run "KNM: Sign in" in VSCode.

## Steps
1. Read the requirement:
   `node .project-knm/tools/knm-api.js get requirement $ARGUMENTS`
   Not found: STOP. `status` must be `approved`; otherwise STOP and say the product owner must approve it first (give the current status). Note `projectId`, `decisionId`, `createdBy`, `documentLinks`.
2. Read its documents if linked (missing is fine): for `documentLinks.doc` and `documentLinks.mock-ascii`:
   `node .project-knm/tools/knm-api.js GET /api/projects/<projectId>/docs/<path>`
3. Read the decision (`get decision <decisionId>`), its feature (`GET /api/change-requests/<featureId>`), the project and blueprint if `documentLinks.blueprint` is set (`GET /api/projects/<projectId>`, then `GET /api/projects/<projectId>/docs/<path>`).
4. List the applications:
   `node .project-knm/tools/knm-api.js GET /api/projects/<projectId>/apps`
5. Draft in memory: a short `title`; `impl.md` (approach, areas and files likely affected, risks, assumptions; header line "Applications: <primary> (primary), <others>"); the PRIMARY application (where most of the work lives) and zero or more OTHER applications the work also touches (a requirement that clearly needs an API and a web app is not a gap: the main one is primary, the other is listed). Never guess an ambiguous application: if the context does not point to one, that is a question.
6. If there are NO open questions (including the application):
Write `.knm/tmp/body.json` with the Write tool:
```
{"requirementId":"$ARGUMENTS","applicationId":"APP-..","otherApplicationIds":["APP-.."],"title":"...","description":"short summary"}
```
Then run:
```
node .project-knm/tools/knm-api.js POST /api/work-items --file .knm/tmp/body.json
```
   The reply has the new work item `id`. Then:
Write `docs/workitems/<new id>/impl.md` with the Write tool:
```
(impl.md text)
```
Then run:
```
node .project-knm/tools/knm-api.js upload --entity-type workitem --entity-id <new id> --key doc --file docs/workitems/<new id>/impl.md
```
   Report the id and the path. The next step is `/finalize-workitem <id>`.
7. If there ARE open questions:
   - Application known, other gaps: create the work item as in step 6 (description "Pending clarification - see Q&A"), but do NOT write impl.md. Ask on the work item (entity type `workItem`).
   - Application ambiguous: do NOT create the work item (the primary application is required). Ask on the requirement (entity type `requirement`).
Write `.knm/tmp/body.json` with the Write tool:
```
{"entityType":"workItem","entityId":"<id>","assignedTo":"<requirement createdBy>","questions":[{"id":"q1","type":"single_choice","text":"Which application is the primary one?","options":["api","web"],"required":true,"reason":"..."}]}
```
Then run:
```
node .project-knm/tools/knm-api.js POST /api/qna/questions --file .knm/tmp/body.json
```
   Question types: `single_choice`, `multi_choice`, `yes_no`, `text`, `long_text` (choices need `options`). Report the questions and tell the user to answer them in KNM, then run `/finalize-workitem <work item id, or the requirement id when no work item exists>`.

## Stop and ask
- Requirement not found or not approved.
- The application cannot be decided (raise the question, never pick one).
- Unclear scope or technical choices that change the plan (raise the question).
- 401/403 (sign in), 409 or 422 (for example an unknown application): show the message, do not retry blindly.
