---
name: create-walkthrough
description: Create or extend a clickable guided walkthrough of the project (mock screens with sample data, a step sequence, a gap list) from the documents listed in docs/project/context.md, validate it, and record it in context.md. Never invents behaviour: gaps become a "Not defined" alert and a gap-list entry.
---
<!-- knm-managed: v1 version: 3 -->
# Create a walkthrough

Usage: `/create-walkthrough [app]`

A walkthrough is a scripted tour of a mock app: a sequence of steps, each showing one mock screen as one user, with a floating card saying what to do next. The mock app is a faithful, clickable picture of the spec. It never invents behaviour. Each walkthrough is its own numbered folder, `docs/mock/<id>/` (`001`, `002`, ... counted up by the helper), with its own engine, so it can be opened and shared on its own. Nothing outside `docs/` is touched.

## Rules that always apply
1. **The spec is the source of truth and is read only.** The spec is `docs/project/context.md` and **every document it lists** (blueprint, requirements, mocks, DB design); when `context.md` is empty or missing, the documents in `docs/project/` (say so). Never edit them. Where they are silent or contradict each other, show a "Not defined" alert in the mock and record the gap in the gap list. Do not guess. Finalized documents beat drafts; on a conflict between sources, ask.
2. **Sample data only.** Names, ids and numbers are invented. Mark each seed file with a `_sample` key saying so.
3. **Suggest before adding extras.** Build what was asked. Propose anything beyond it and wait for approval.
4. **Every walkthrough must pass the validator** before you report it done.
5. **Feedback is off** in the bundled engine (no sign-in, nothing is sent anywhere). Do not add any network call.

## Folder layout
```
docs/mock/<id>/                    one mock = one numbered folder (001, 002, ...)
  walkthrough/                     the engine (installed by the helper; app-agnostic, never edit, never put content in it)
  apps/
    apps.json                      { "apps": [{ "name", "title", "platform": "desktop"|"mobile" }] }
    <app>/
      roles.json                   user key -> { label, color }; one entry per user in users.json (add-user keeps both in step)
      app.json                     name, title, spec, walkthroughs [{ id, title, description, sequenceFile, seedData }]
      mock-app/                    index.html, router.js, store.js, bridge.js, registry.js, shared/ (copied from the template)
        screens/<side>/*.js        one module per screen
        mock-data/users.json, seeds/<id>.json, spec/screens.json
      sequences/<id>.json          one file per walkthrough
      gaps/<id>.md                 spec gaps found while building it
```
`platform` is `desktop` (full width, a phone-view toggle) or `mobile` (always the phone-sized box; design phone-first). All paths in `app.json` are relative to `apps/<app>/`.

## Steps
### 1. Pin down the walkthrough
Read the context first (rule 1). Ask in one batch, each with a suggested answer, only what is not clear from the documents: which app (new or existing), its title and platform, the walkthrough name and id (kebab-case), the actors (roles; the `Roles` fact of `context.md` is a start), the start and the end, and which part of the spec. List the screen codes the tour touches, in order. Do not start building before the answers.

### 2. Pick or create the mock folder
`node .project-knm/tools/knm-context.js mocks` lists the existing mocks with their apps and the next id.
- **New walkthrough app or a separate walkthrough:** `node .project-knm/tools/knm-context.js new-mock` creates the next `docs/mock/<id>/` and installs the engine into it. Use the returned `id` everywhere below.
- **Extend an existing mock** (more screens, another sequence): ask which id, and refresh its engine with `node .project-knm/tools/knm-context.js install-engine --mock <id>` (files you or the user edited are kept).
If the helper says the bundled engine is missing, tell the user to run "KNM: Install files" in VSCode.

### 3. Create the app (new app only)
`node .project-knm/tools/knm-context.js new-app <name> --title "<Title>" --platform mobile|desktop --mock <id>` creates `docs/mock/<id>/apps/<name>` from the bundled template, empty data files (including `users.json` and `roles.json`, both `{}`), and registers it in `apps/apps.json`. It refuses an existing app.

Then add the actors, one command each. It writes the same user to `mock-data/users.json` and to `roles.json`, so the two cannot drift:
`node .project-knm/tools/knm-context.js add-user <key> --name "<Name>" --role-label "<Role>" --color "#2563eb" --mock <id> --app <app> [--side <side>]`

`users.json` shape: `{ "<key>": { "name": "Asha Rao", "roleLabel": "Owner", "side": "main" } }`. `name` is required, `roleLabel` is shown on the role chip (the validator warns when it is missing), `side` is optional (the shell groups tabs by each screen's `meta.side`, not the user's). Keys starting with `_` (for example `_sample`) are metadata, not users. `roles.json` shape: `{ "<key>": { "label": "Owner", "color": "#2563eb" } }`. Every user needs a `roles.json` entry or the validator fails; do not write either file by hand when `add-user` can.

### 4. Index the spec screens
`mock-data/spec/screens.json` lists the spec's screens: `[{ "code", "name", "section", "type", "mode", "buttons", "fields" }]`, written by hand from the spec documents (there is no extraction script). Use the spec's own screen codes; when the spec has none, make codes (S01, S02, ...) and say so in the gap list. Controls that lead to a screen the tour does not build use `data-spec-code="<CODE>"` and the engine announces what would open.

### 5. Build the mock screens
One module per screen at `screens/<side>/<name>.js`:

```js
import { pageHead, field, esc } from '../../shared/components.js?v=1';
import { button, input } from '../../shared/form.js?v=1';

export const meta = { code: 'S02', name: 'Orders', side: 'main', icon: 'home', nav: 'Orders', roles: ['owner'] };

export function render({ user, data, params }) { return `…html string…`; }
```

- `meta.code` must equal the key it is registered under; `meta.name` is the spec's screen name.
- `render` returns an HTML string from `data` (the seed). No network calls, no real logic.
- Controls, by what they do:
  - Moves the tour on: `data-action="<id>"`. The id must have a rule in the sequence.
  - Goes to another screen (menu, link): `data-goto="<CODE>"`; the engine sees it as `goto-<CODE>`.
  - Anything else: `data-toast="<label> would <what it does>."`, taken from the spec.
  - Spec silent: `data-not-defined="<what is missing and where the spec should say it>"`.
- Use the shared helpers so every screen looks and behaves the same. In `shared/components.js`: `esc`, `inr`, `badge`, `statusTone`, `table(headers, rows)`, `field`, `pageHead`. In `shared/form.js`: `input`, `select`, `radios`, `button`. Tabs, cards and rows are CSS classes (`tabs`, `tab`, `card`, `row`, `kpis`) in `shared/styles.css`; copy the markup from an existing screen.
- The shell is the bundled template (`mock-app/shared/shell.js`): a header with the acting user and a bottom tab bar built from the screens that set `meta.nav` for the user's `side` (a sign-in sets `meta.bare = true`). Adapt the shell for a desktop app (sidebar) only when asked.
- A screen that changes with the tour keeps its state in the seed (for example `scan.result`, `delivery.status`) and renders from it; the sequence moves the state with `stateChange`.
- Each app's `store.js` has its own `sessionStorage` key (from its folder), so apps do not share state in one browser tab.
- Register it in `mock-app/registry.js`: `S02: './screens/main/orders.js?v=1'`. Bump the `?v=` of a screen module on edits so browsers reload. Template files (`shared/*`, `router.js`, `store.js`, `registry.js`) keep `?v=1` everywhere they are imported, including the walkthrough's `main.js`, so no module is loaded under two URLs. Do not bump those.

### 6. Seed data
`mock-data/seeds/<id>.json`: the state the tour starts from. Every key a step reads (`infoPanel`) or changes (`stateChange`) must exist here. Include the `_sample` note.

### 7. Write the sequence
`sequences/<id>.json`:

```json
{
  "id": "create-order",
  "title": "Creating an order",
  "startStep": "orders-list",
  "completionMessage": "What happened and what comes next in the real flow.",
  "steps": {
    "orders-list": {
      "user": "owner",
      "screen": "S02",
      "proposedAction": "Click add",
      "infoPanel": [{ "key": "orders.count", "label": "Orders" }],
      "actions": {
        "add-order": { "performedText": "clicked add", "nextStep": "order-detail" }
      }
    },
    "order-detail": {
      "user": "owner",
      "screen": "S03",
      "proposedAction": "Check the profile",
      "notDefined": "How login details are handed over is not defined in the spec.",
      "performedText": "checked the order",
      "nextStep": null
    }
  }
}
```

Step rules (the validator enforces these):
- `user` is a key in `users.json`. `screen` is a registered code.
- A step **with** `actions`: each action id is on the screen (or `goto-<CODE>`), has `performedText` and a `nextStep` (a step id, or `null` to end). It must not also carry `nextStep` or `notDefined`: the engine shows a step-level Not defined alert only for a step without actions. For a gap on a control of a step with actions, put `data-not-defined` on that control in the screen; to alert before the control is used, add a no-action step before it.
- A step **without** `actions` passes straight on: it needs `nextStep` (or `null`), and may carry `notDefined`, `performedText` and `stateChange`.
- `stateChange`: `{ "key.path": 1 }` adds a number; `{ "key.path": { "set": value } }` sets. The key must exist in the seed.
- Text in the sequence can pull values from the seed: `{order.id}`, or `{order.advanceDue|inr}` for rupees, and names from `users.json` as `{users.<user-key>.name}`.
- A `stateChange` value can copy another seed value: `{ "copy": "order.advanceDue" }`.
- `proposedAction` is a short imperative ("Click save"). It is shown in the floater and the next-step popup.
- Every other screen action with no rule just shows a hint, so give rules to the controls the tour should use.

### 8. Write the gap list
`gaps/<id>.md`, numbered, one gap each: what the spec says, what it leaves out, and what the walkthrough shows instead. Keep a second section "Walkthrough notes (not spec gaps)" for engine choices. Record every `data-not-defined` and every assumption (for example "landing after save").

### 9. Register
Add the walkthrough to `app.json` (`walkthroughs`) and each new screen to `mock-app/registry.js`. Nothing else lists it.

### 10. Validate
`node .project-knm/tools/knm-context.js validate-mock <id> --app <app>` runs the walkthrough validator. It must print `OK` for the walkthrough (on a problem it prints the validator's output and exits 1). With `--app` it then loads `walkthrough/?app=<app>` in headless Chrome and fails on any uncaught console error or when the number of cards differs from `walkthroughs` in `app.json` (`smoke-mock <id> --app <app>` runs only that part). It prints `smoke: SKIPPED` when no Chrome/Chromium is found (set `KNM_BROWSER` to its path): then the page was not loaded, so say so in the report. `OK` from the validator alone does not prove the page opens. Fix errors; read warnings and either fix or accept them knowingly. Each screen is rendered with the data at that step (the seed with the `stateChange`s along the first path to the step applied).

Checks the validator makes: `roles.json` exists and has an entry for every user in `users.json` (keys starting with `_` are ignored); sequence and seed load; `startStep` exists; each step's user, screen, action ids, `nextStep` targets, `stateChange` and `infoPanel` keys; unreached steps; actions on screen with no rule. **Not built yet:** the spec-coverage and mobile checks (viewport meta, no fixed widths above 360 px, tables in the scroll wrapper, 44 px targets, 16 px inputs) and "gap file exists for every `notDefined`": check those by hand and say so in the report.

### 11. Show it
The browser needs a server. Tell the user (do not start one yourself): from `docs/mock/<id>/` run `python3 -m http.server 8765`, then open `http://localhost:8765/walkthrough/?app=<app>`. `validate-mock --app` has already loaded the page headlessly (step 10); say whether that check ran or was skipped. Walk the tour yourself only if a browser tool is available; otherwise say it was validated but not looked at.

### 12. Update the context (last write)
`node .project-knm/tools/knm-context.js add docs/mock/<id>/ --what "Walkthrough <id>: <app>, <walkthrough titles>; gaps in apps/<app>/gaps" --by create-walkthrough --status draft`
If the actors you used are not in `context.md` and the user confirmed them, `node .project-knm/tools/knm-context.js set Roles "<comma list>"`. Do not rewrite `context.md` by hand: the helper keeps the table and the user's other text.

### 13. Report (short)
Mock id and folder, app, walkthrough ids, validator result, the number of gaps (these are the first open questions), what was not checked (step 10), and the command to open it.

## Mobile requirements

Mock screens (inside the frame; the template styles already do the first four, keep them true):
- Layout works from 360 to 430 px wide, with no sideways page scroll. The sidebar collapses to a menu button below 768 px (extend the existing 768 px breakpoint in the shared styles; do not duplicate it).
- Wide tables sit in a horizontally scrollable wrapper; forms stack to one column.
- Tap targets at least 44×44 px; inputs at least 16 px font size (prevents iOS zoom).
- No hover-only information or actions.

Walkthrough chrome (outside the frame):
- Top bar uses icon buttons (back, restart, exit) with the `N/M` progress between back and restart.
- The step floater docks to the top (outside the frame) or bottom (fixed), or floats; when docked at the bottom the stage leaves room so nothing is covered.
- The feedback panel works at phone width and docks to the bottom.
- Phone view: a plain 390×844 box. Always on for `mobile` apps; the 📱 toggle for `desktop` apps.

## Not yet verified
This skill was adapted from the original walkthrough skill (KNM-025). The page load is checked headlessly (no clicking through the tour), so a tour that loads but misbehaves on click is not caught. On first real use, note anything that does not work and fix this file.

## Common mistakes

- Registering a screen under a code that differs from its `meta.code`.
- An action id in the sequence that no longer exists on the screen after the mock was edited. Run the validator after every mock edit.
- Editing the spec documents, or filling a spec gap with invented behaviour instead of a "Not defined" alert.
- `stateChange` on a key missing from the seed, or adding a number to a non-number.
- A user in `users.json` with no `roles.json` entry (use `add-user`), or `roles.json` missing.
- Giving a step both `actions` and `notDefined`/`nextStep` (see step 7).
- Editing files with `sed -i` on macOS: it needs an empty backup suffix, `sed -i '' 's/a/b/' file` (GNU sed on Linux takes `sed -i 's/a/b/' file`). Prefer your editor tool for edits.
- Forgetting to bump `?v=` after editing a screen module, so the browser shows the old screen.
- Putting app-specific content in `walkthrough/`. That folder stays app-agnostic.

## Stop and ask
- `context.md` and `docs/project/` have no documents to build the spec from.
- Sources conflict, or a screen's behaviour would need a guess (it becomes a "Not defined" alert and a gap, but ask first when it is central to the tour).
- The app already exists and the request would overwrite its screens or sequences.
- The helper or the validator fails in a way you cannot explain.
