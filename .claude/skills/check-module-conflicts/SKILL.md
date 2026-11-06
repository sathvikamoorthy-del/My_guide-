---
name: check-module-conflicts
description: Semantic duplicate check for adding a module to an app. Reads only the directories the module would touch and reports whether the project already implements a similar capability (even at a different path). Read-only; never edits files. Used by the Verify step of the scaffolding session.
tags: [modules, conflicts, verify]
---
<!-- knm-managed: v1 version: 1 -->

# Check Module Conflicts (semantic duplicates)

Usage: `/check-module-conflicts <module-id> <app>` (normally invoked by the `scaffold-session` skill during Verify, with the report below)

## What this does
The deterministic part of conflict detection (file-path collisions, already-installed, declared conflicts, exclusive capabilities, missing glue, package majors) is done by the conflict report (STORY-050 `detectConflicts`, `backend/scripts/conflictReport.ts`).
This skill does the part code cannot: judge whether the project **already implements a similar capability**, for example a different auth mechanism at a different path.

## Input (from the report's `semanticScope`)
- `dirs`: the only directories you may search.
- `files`: existing files in those directories (read these first).
- `keywords`: module type/id/name words and the capabilities it provides.
- The module's `name`, `description`, `provides`.

## Steps
1. Read each file in `files`, then search only inside `dirs` for the keywords and for code that provides the same capability (names, imports, routes, config keys, packages in `package.json`).
2. Do **not** read or search outside `dirs`. Do **not** edit, create or delete any file. Do not run the project.
3. For each candidate found, record: `path`, `evidence` (one line), `confidence` (`high` / `medium` / `low`), `suggestion` (`use the existing code` / `replace it with the module` / `ignore: different purpose`).
4. Be honest about gaps: if nothing is found, say so; do not invent matches.

## Output (concise)
```json
{ "verdict": "none | possible | likely",
  "similar": [ { "path": "apps/api/src/auth/session.ts", "evidence": "custom JWT verification middleware", "confidence": "high", "suggestion": "replace it with the module" } ] }
```
Then a two-line plain summary for the user. The Verify step shows this next to the deterministic findings; the user decides (this result never blocks by itself).

## Notes
- The scope is limited on purpose: cost and noise. If the user wants a wider search, they ask for it explicitly.
- Findings from the deterministic report (errors) are not repeated here.
