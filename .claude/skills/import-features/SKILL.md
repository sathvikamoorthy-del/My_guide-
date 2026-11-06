---
name: import-features
description: Import features from the project context (docs/project/context.md and the documents it lists; every document in docs/project when it is empty or missing). Creates each feature with its decision and requirement in KNM. Skips features that already exist; asks on near matches and on anything unclear.
---
<!-- knm-managed: v1 version: 4 -->
# Import features

Usage: `/import-features`

Creates, per feature found in the project documents: the **feature**, a **finalized decision**, a **requirement** (status `created`, no draft step) and the requirement's **documents** (`req.md` and `mock.md` in the docs repo). The web Import button (blueprint HTML to features only) is separate.

All API calls go through the helper `node .project-knm/tools/knm-api.js` (it signs in for you); request bodies are written with the Write tool to `.knm/tmp/`, documents to their own path `docs/requirements/<id>/<file>` (the path the API commits to; keep the file there), and both are passed with `--file` (never inline in the shell command). Do not call the API any other way and do not read or print credentials. If the helper says to sign in, stop and tell the user to run "KNM: Sign in" in VSCode.

## Steps
1. Project id: `node .project-knm/tools/knm-api.js whoami`. If it is not clear, ask.
2. Context. Read `docs/project/context.md` and **every document it lists**; take all of it into account, not only the blueprint.
   - `context.md` empty or missing: use the documents in `docs/project/` instead (say so).
   - Finalized documents beat drafts. If sources conflict, ask; do not pick.
3. Existing features and groups:
   `node .project-knm/tools/knm-api.js GET /api/change-requests --query projectId=<projectId>`
   `node .project-knm/tools/knm-api.js GET /api/projects/<projectId>/groups`
4. Draft IN MEMORY, for every feature the documents describe (write nothing yet):
   - **Each feature is a story that can be implemented** (all must hold; otherwise split, merge or turn it into a question):
     1. One actor and one outcome. The description starts with `As a <role>, I can <outcome>` (the roles are named in the documents; an unnamed actor is a question, not a guess).
     2. A vertical slice: what the user sees, the API and the data it needs, so it can be shown working on its own.
     3. Testable: an `Acceptance` list of 2 to 6 observable points. A point you cannot check ("works well", "is secure") is rewritten or asked.
     4. Small: implementable and testable in a few days. A feature that covers a whole area ("User management", "Reports") is an epic: split it into stories (invite a user, change a role, list users). A feature too small to test alone ("add a button") is merged into the story it belongs to.
     5. Not a chore: "set up the database", "configure CI" are not stories. If the documents need them, they are an enabling story with a user-visible outcome (e.g. "As a developer, I can run the app locally with seeded data") or part of the first story that needs them.
   - **Each feature has an implementation order.** Number the stories 1 to N in the order they should be built: a story comes after every story it depends on (sign-in before anything that needs a user, the data a screen shows before the screen, the screen before reports on it); among independent stories, the one the documents call more important or riskier comes first. Write the reason for each position in the draft table (`after 2: needs sign-in`).
   - **The order is stored by the groups and by creation order**, because KNM numbers features from the group order, then the order inside the group (the tree and the lists show `#1`, `#2`...). So make the groups consecutive phases: a group holds a run of stories that follow each other in the order (`1. Foundation`, `2. Hiring`), never stories that are interleaved with another group's. When a dependency forces an interleave, split the group into two phases. Existing groups keep their place; new stories go to the end of a fitting existing group only if that keeps the order true, otherwise into a new phase group after it. Create the features in the order 1 to N.
   - Feature: `title` (short, outcome-first: `Guest can book a table`), `description` (the `As a ... I can ...` line, then one line on why), `group`.
   - Decision: `rationale` = why the feature is wanted, from the documents, naming the source document.
   - Requirement: `title`, `description` (what it is, then an `Acceptance` list of testable points).
   - Requirement documents: `req.md` (purpose, behaviour, acceptance criteria, **`Order: <n> of <N>` and `Depends on: <story titles or "none">`**, source documents, and an `Open questions` section for every gap) and `mock.md` (an ASCII wireframe or flow in a code fence, only of what the documents describe).
   - Never invent scope. What the documents do not say becomes a question, not text.
5. Duplicates: skip a feature whose title matches an existing one (ignore case and punctuation; ignore any leading `#n`). A near match (similar title, same intent) is asked, one question each: skip or create.
6. Show the draft as a short table **in implementation order** (`#`, group, feature, depends on / reason, new / skipped) with the stories you split, merged or could not make implementable, and the open questions. Ask the user to confirm or change the order and the split. Nothing is created before the user confirms.
7. Create, after confirmation. Bodies must be valid JSON (double quotes, escaped newlines).
   - Features, in one call, **in order 1 to N** (the API gives each its position inside its group in this order). Write `.knm/tmp/body.json` `{"projectId":"...","features":[{"title":"...","description":"...","group":"..."}]}`, then:
     `node .project-knm/tools/knm-api.js POST /api/change-requests/bulk --file .knm/tmp/body.json`
     The response lists the features with their ids.
   - Per new feature, write `.knm/tmp/body.json` `{"featureId":"...","title":"...","rationale":"..."}`, then:
     `node .project-knm/tools/knm-api.js POST /api/decisions --file .knm/tmp/body.json`
     (created finalized; 409 = the feature already has one: skip it and report).
   - Per decision, write `.knm/tmp/body.json` `{"decisionId":"...","title":"...","description":"..."}`, then:
     `node .project-knm/tools/knm-api.js POST /api/requirements --file .knm/tmp/body.json`
   - Per requirement, write its documents, then upload them (the upload also sets the document links `doc` and `mock-ascii`). Write `docs/requirements/<requirementId>/req.md` with the Write tool, then:
     `node .project-knm/tools/knm-api.js upload --entity-type requirement --entity-id <requirementId> --key doc --file docs/requirements/<requirementId>/req.md`
     Write `docs/requirements/<requirementId>/mock.md` with the Write tool, then:
     `node .project-knm/tools/knm-api.js upload --entity-type requirement --entity-id <requirementId> --key mock-ascii --file docs/requirements/<requirementId>/mock.md`
   - On an error for one feature, report it and continue with the next. Never retry a 409 or 422 blindly.
8. Update the context (always the last write; it records what was done so the next skill and the Context panel see it):
   `node .project-knm/tools/knm-context.js add docs/requirements/ --what "Requirement documents of the imported features" --by import-features --status draft`
   If a source document states the target database, stack or roles, set them (`node .project-knm/tools/knm-context.js set "Target DB" "<value>"`, `Stack`, `Roles`); never guess one. Do not rewrite `context.md` by hand: the helper keeps the table and your other text.
9. Check the order: list the features again (`GET /api/change-requests` and `GET /api/projects/<projectId>/groups`), sort them by group `sortOrder`, then feature `sortOrder`, and confirm the new ones come out as 1 to N relative to each other. If not, say which are out of place and why; do not reorder anything silently.
10. Report, short: created in order (`#`, feature, decision and requirement ids, the two document paths per requirement), skipped, failed, stories split or merged, open questions.

## Stop and ask
- A feature cannot be made an implementable story without a guess (no actor, no outcome, no checkable acceptance).
- Two stories depend on each other (a cycle): ask which comes first.
- No documents found in `docs/project/`.
- Conflicting sources, near-duplicate titles, or any gap you would otherwise guess.
- A document would need content the sources do not give: list it under `Open questions` in `req.md`, do not invent it.
- The helper reports 401/403 (sign in), 409 or 422: show the message.
