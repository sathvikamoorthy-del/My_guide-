---
name: create-db-design
description: Generate or update the DB design of the project from requirements, mocks and the documents listed in docs/project/context.md. Two files - docs/project/db_design_tables.csv (the table list with feedback and status) and docs/project/db_design.md (target DB, constraints and the columns of each table). Asks when the target DB, constraints or sources are unclear.
---
<!-- knm-managed: v1 version: 2 -->
# Create DB design

Usage: `/create-db-design`

Writes two files in `docs/project/`: `db_design_tables.csv` (one row per table, edited in a spreadsheet or by hand) and `db_design.md` (target DB, constraints, the columns of each table). Re-run to update them: both are edited in place, history is git.


## Inputs
1. `docs/project/context.md`: lists the documents to use. Read it first, then every document it names.
2. Requirements (`req.md`) and mocks (`mock.html` / `mock.md`) of the entities in scope. Every field a mock shows needs a column; a table no mock or requirement uses is flagged.
3. Existing `db_design_tables.csv` and `db_design.md`, if any: keep their rows, feedback and statuses.

Finalized documents beat drafts. If sources conflict, do not pick: ask.

## Ask first (one batch, with a suggested answer each)
- Target DB (engine and version) when neither the document nor `context.md` states it.
- Constraints not stated: naming, id type, timestamps, soft delete, tenancy, audit columns, 3NF, hosting limits.
- Conflicts between sources, and anything you would otherwise guess. A guess is not allowed; an open point becomes a question or a `Feedback` row.

Record answers at the top of `db_design.md` (Target DB, Constraints). Do not start the tables before the target DB is known.

## File layout
**`docs/project/db_design_tables.csv`**: the list of tables. UTF-8, comma separated, one header row, fields with a comma, quote or newline in double quotes (RFC 4180), no blank lines.
```
table,pk,important_fields,description,feedback,status
projects,id,"name, owner_id",A project,,New
features,id,"project_id, title, status",A feature of a project,Need sort order,Feedback
feature_statuses,code,"code, label","Reference: created, discussed, approved, cancelled",,Final
```

**`docs/project/db_design.md`**: header and columns.
```
# DB design
Target DB: <engine version>
Constraints: <one line each: naming, ids, timestamps, soft delete, tenancy, audit, 3NF, ...>
Sources: <documents used, with ids>
Tables: db_design_tables.csv (Status: New = proposed by Claude · Feedback = open feedback to apply or answer · Final = accepted)

## Columns
### <table name>
| Column | Type | Null | Default | Key / FK | Index | Constraints | Description |
```
- The CSV lists every table, reference (lookup) tables too; seed values of a reference table go in `description`.
- **Columns**: one `###` section per CSV row, same order. Key / FK says `PK`, `FK -> table.column` or `UQ`. Constraints holds the rest (check, unique together, on delete). Types are the target DB's own types. Foreign keys always name the referenced column.
- `feedback` and `status` exist only in the CSV, one per table. The columns tables have neither.
- Low verbosity: one short phrase per cell. Longer notes go to `db_design_details.md`, linked from the description.

## Status and feedback
- A new or changed table is `New`. Claude never sets `Final`.
- The user writes feedback in the `feedback` field of the CSV row. A table with unaddressed feedback is `Feedback`.
- Applying feedback: change the table and its columns, keep the feedback text prefixed `Done:` and set `New` (the user re-reviews).
- `Final` is set by the user, per table.
- Never change a `Final` table silently. If an input changed it, set it back to `Feedback` with the reason in the `feedback` field.

## Checks before finishing
- Every CSV row has a Columns section, and the reverse. The CSV parses: every row has six fields, `status` is only New, Feedback or Final.
- Every FK points to an existing table and column; PK columns exist and are not null.
- Every mock field has a column; each table is used by a mock or requirement.
- 3NF unless the Constraints line says otherwise; deviations are noted in the row.

## Update the context (last write)
`node .project-knm/tools/knm-context.js add docs/project/db_design.md --what "DB design: columns, target DB, constraints" --by create-db-design --status draft`
`node .project-knm/tools/knm-context.js add docs/project/db_design_tables.csv --what "DB design: table list, feedback, status" --by create-db-design --status draft`
and the confirmed target database: `node .project-knm/tools/knm-context.js set "Target DB" "<engine version>"`. Do not rewrite `context.md` by hand: the helper keeps the table and the user's other text.

Report: short list of tables added, changed, flagged, and the open questions.

## Stop and ask
- The target DB is unknown, or sources conflict, or a point would need a guess.
- A table is `Final` and an input changed it: set it to `Feedback`, never change it silently.
