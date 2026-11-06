---
name: apply-module
description: Adds one module to an app in this project: picks the variant, handles a version gap (warn, agree, questions, confidence; low = refuse), previews, injects, adapts the copied code within the declared adaptation points (contract tests fixed), verifies, and records the injection. Normally driven by the `scaffold-session` skill (STORY-109) on behalf of the website. Uses .project-knm/tools/knm-module.js.
tags: [modules, scaffolding]
---
<!-- knm-managed: v1 version: 1 -->

# Apply Module (one module, one app)

Usage: `/apply-module <module-id> <app-name>`

The deterministic work (variant match, conflicts, dependencies, preview, copying, glue registration, hashes, guards, the record) is done by the bundled tool. **Your part is the judgement and the adaptation.** You adapt the module; you do not author it.
Definitions: `docs/module_readiness.md` (module), `docs/stack_profile.md` (glue, capabilities), `docs/apply_engine.md` (this flow).

## Setup
- Tool: `node .project-knm/tools/knm-module.js <command> --modules-dir <dir> --registry <file> --module <id> --target . --app <app> [flags]`. Every command prints JSON; exit 0 = ok, 1 = blocked.
- `--modules-dir` is a copy of project_knm's `modules/`; `--registry` is `moduleRegistry.json`. The session skill passes both. If you run this manually and do not have them, ask the user for the two paths. Do not guess.
- The target repo must have a **clean git tree** (the tool refuses otherwise; never stash or commit on the user's behalf to get around it).

## Steps

1. **Pick the variant.** `select-variant`.
   - `decision.stage = ready` -> continue.
   - `agree`: show `warning` verbatim ("this module was written for X; you are adapting it to Y") and ask the user to agree. No -> stop, nothing written.
   - `questions`: ask the `adaptationQuestions` (`source: module` = the module's own questions; `source: llm` = write the questions yourself: what concretely changes between the two versions for THIS module's files, in plain choices). Collect the answers. Re-run with `--agreed yes --questions-answered`.
   - `confidence`: **you rate your confidence now, before anything is written**: read the variant's files (`<modules-dir>/<id>/variants/<variant>/files`), the adaptation points, and the target app's conventions. Answer `high`, `medium` or `low` with concrete reasons (what could break, how many files are touched, how big the version/framework jump is). Re-run with `--confidence <level> --reasons "a;b"`.
   - `refused` (or confidence `low`): stop. Tell the user plainly why; nothing was written. Never retry with a higher confidence to get past it.
2. **Conflicts and duplicates.** `conflicts` (deterministic; errors block). Then `/check-module-conflicts <module-id> <app>` with the report's `semanticScope` (semantic duplicates, read-only). Show both.
3. **Dependencies and config.** `resolve --questionnaire-out <file>`. A missing dependency blocks (tell the user what to add first; no auto-chain). If the module has config questions, have the user answer them (in the scaffolding website, or in chat when run by hand) and keep the answered questionnaire file for `--answers`.
4. **Preview.** `preview --answers <file>` (it adds the version-gap flags too if they apply). Show `markdown` as is (shared format, no code). The user answers **Accept**, **Refine** (change the selection and re-run) or **Reject** (stop).
5. **Prepare** (only after Accept): `prepare --answers <file> [--agreed yes --questions-answered --confidence ...]`. It copies the variant, registers it in the glue files at the declared extension points, adds config keys and package dependencies, updates `stack.json`. If it is blocked it wrote nothing.
6. **Adapt** (only now), within the rules:
   - You may change **only the files listed as adaptation points** in the variant (`what` says what may change: names, paths, imports, config wiring, framework idioms). Apply the user's adaptation answers. For a version/framework/language gap this is where the port happens.
   - **Contract tests** (`tests/modules/<id>/contract/`): you may adapt setup, imports and fixtures only. **Never remove, rename, skip or weaken a test or an assertion.** If a contract test fails, fix the module code (within the adaptation points) or stop and report; never edit the assertion.
   - **Fit tests** (`.../fit/`): adapt freely so they fit the app.
   - Do not edit glue files except the line the tool inserted for this module (tagged `// knm:module <id>`), and only to keep the import/symbol correct after an adaptation.
   - If you rename files (for example `.ts` -> `.js` in a port), write `{"<old path>": "<new path>"}` to a JSON file and pass it to `finalize --renames`.
7. **Finalize.** `finalize [--renames file.json] --answers <file>`. Warnings (`edit-outside-adaptation-points`) are shown to the user. Errors (`contract-weakened`, `missing-injected-file`) mean fix and run `finalize` again; the prepared state is kept.
8. **Verify.** `verify` (built-in build/test/lint for TypeScript/JavaScript). On failure fix inside the adaptation points and re-run, or report honestly. Then run `/code-review` on the diff as an **advisory** review (findings never block).
9. **Report briefly**: module, version, variant, `adaptedFrom` (if any), files created/modified, verify result, warnings, advisory review notes. Remind: rollback is `git checkout -- . && git clean -fd`; the result is uncommitted for the user to review.

## Rules
- Never write before the user accepted the preview. Never bypass a blocker. Never lower a refusal.
- If the tool and these instructions disagree, the tool wins and you report the mismatch.
- Cohesion review across modules (`/cohesion-review`) is a separate step run by the session skill after apply.
