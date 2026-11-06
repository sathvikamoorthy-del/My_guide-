---
name: add-requirement
description: Draft a Requirement from a finalized Decision (title, description, acceptance, open questions) and save it as a DRAFT in KNM for the product owner to review. Never creates the requirement itself; if something is unclear it becomes a question, not a guess.
---
<!-- knm-managed: v1 version: 1 -->
# Add Requirement (draft from a Decision)

Usage: `/add-requirement <decision-id>`

Two-step flow. This skill only SAVES A DRAFT. The product owner reviews it in KNM and approves it (that creates the requirement); then `/finalize-requirement` writes the documents.

All API calls go through the helper `node .project-knm/tools/knm-api.js` (it signs in for you); request bodies are written with the Write tool to `.knm/tmp/` and passed with `--file` (never inline in the shell command). Do not call the API any other way and do not read or print credentials. If the helper says to sign in, stop and tell the user to run "KNM: Sign in" in VSCode.

## Steps
1. Read the decision:
   `node .project-knm/tools/knm-api.js get decision $ARGUMENTS`
   Note `featureId`, `title`, `rationale`, `projectId`. If it is not found, or `status` is not `finalized`: STOP and say so.
2. Read its feature:
   `node .project-knm/tools/knm-api.js GET /api/change-requests/<featureId>`
3. Read the project, and the blueprint if linked (no blueprint is fine):
   `node .project-knm/tools/knm-api.js GET /api/projects/<projectId>`
   If `documentLinks.blueprint` is set: `node .project-knm/tools/knm-api.js GET /api/projects/<projectId>/docs/<blueprint path>` (the text is in `content`).
4. Check for an open draft:
   `node .project-knm/tools/knm-api.js GET /api/decisions/$ARGUMENTS/draft-requirement`
   - `null`: this is a first draft.
   - `state` is `refine`: the owner asked for changes. Read `note` and revise the earlier draft accordingly.
   - `state` is `draft`: one is already waiting for review. STOP and ask the user whether to replace it.
5. Draft IN MEMORY (write nothing yet):
   - `title`: short and clear.
   - `description`: what the requirement is, in markdown.
   - `acceptance`: a list of testable acceptance criteria (one string each).
   - `questions`: everything you cannot decide from the decision, feature and blueprint. One short `reason` each (why you are asking). Never guess an answer and never hide a gap in the description. Question `type` is one of `single_choice`, `multi_choice`, `yes_no`, `text`, `long_text`; choice types need `options`; ids are `q1`, `q2`, ... and `required` is true unless the answer would not change the requirement.
6. Save the draft. The body must be valid JSON (double quotes, escaped newlines, no `\'`):
Write `.knm/tmp/body.json` with the Write tool:
```
{"title":"...","description":"...","acceptance":["..."],"questions":[{"id":"q1","type":"single_choice","text":"...","options":["A","B"],"allowOther":true,"reason":"...","required":true}]}
```
Then run:
```
node .project-knm/tools/knm-api.js POST /api/decisions/$ARGUMENTS/draft-requirement --file .knm/tmp/body.json
```
7. STOP. Tell the user exactly: "Draft saved. Review and approve it in KNM (notification or Open draft); then run /finalize-requirement." Add the draft id and the list of questions. Never create the requirement yourself.

## Stop and ask
- The decision does not resolve or is not finalized.
- A draft is already waiting for review (step 4).
- The helper reports 401/403 (sign in), 409 or 422: show the message, do not retry blindly.
- You are tempted to assume anything about scope, roles, data or rules: make it a question instead.
