---
name: preview-workitem
description: Proposes what implementing a finalized Work Item would change (files with one-line summaries and a schema note) and saves it as the next preview version in KNM. Writes nothing to the repository.
---
<!-- knm-managed: v1 version: 1 -->
# Preview Work Item (before any code is written)

Usage: `/preview-workitem <work-item-id>`

Saves a preview for review in KNM (accept, refine or reject). It never edits files in the repository. All API calls go through `node .project-knm/tools/knm-api.js`; request bodies and documents are written with the Write tool to `.knm/tmp/` and passed with `--file` (never inline in the shell command); never call the API any other way and never read or print credentials. If the helper says to sign in, stop and tell the user to run "KNM: Sign in" in VSCode.

## Steps
1. Read the work item:
   `node .project-knm/tools/knm-api.js get workitem $ARGUMENTS`
   Not found: STOP. `status` must be `finalized`; otherwise STOP and say so (`created`: run `/finalize-workitem` first). Note `projectId`, `requirementId`, `applicationId`, `otherApplicationIds`, `documentLinks`.
2. Read its plan (`documentLinks.doc`, no plan: STOP) and the requirement documents:
   `node .project-knm/tools/knm-api.js GET /api/projects/<projectId>/docs/<path>`
   `node .project-knm/tools/knm-api.js get requirement <requirementId>` (then its `doc` and `mock-ascii` links the same way).
3. Read earlier previews; if the latest has state `refine`, its `note` says what to change:
   `node .project-knm/tools/knm-api.js GET /api/work-items/$ARGUMENTS/previews`
4. Read the repository (read-only) to name real paths. Draft in memory: `files` (each `path` and a one-line `summary`; new files too) and `schemaNote` (data model or API changes, or "none"). Do not guess paths or structure you cannot see: if the plan is too vague, STOP and ask.
5. Save the next version:
Write `.knm/tmp/body.json` with the Write tool:
```
{"files":[{"path":"src/...","summary":"..."}],"schemaNote":"..."}
```
Then run:
```
node .project-knm/tools/knm-api.js POST /api/work-items/$ARGUMENTS/previews --file .knm/tmp/body.json
```
6. STOP. Tell the user: "Preview saved; review it in KNM." Give the version number and the file list. Do not implement anything.

## Stop and ask
- Work item not found, not finalized, or no plan document.
- The plan is too vague to name files.
- 401/403 (sign in), 409, 422: show the message, do not retry blindly.
