## Why

Question terminology is currently defined in duplicated view code and locale files. The public Questions and Responses pages can explain terms such as DNF, but visitors have no single definitions list to consult and an admin cannot update those explanations without a code change. An inventory of the current terms shows a useful hybrid: a small set of global terms (DNF, DNS, DSQ, Grand Prix) plus question-scoped terms (podium, selected races, grid wins, engine teams, damage, and initial lineup).

## What Changes

- Add a database-backed definitions catalog with localized labels, explanations, aliases, ordering, active status, and optional question bindings.
- Seed the catalog with the existing tooltip definitions so current wording and highlighting remain intact during migration.
- Replace duplicated Questions/Responses term-matching logic with one shared definition-aware renderer.
- Add a public definitions page and link to it from the public Questions experience; stop maintaining a second hardcoded definitions list in About.
- Add a Definitions section under admin Inputs with protected add, edit, reorder, activate/archive, and translation workflows.
- Keep definitions presentation-only: scoring, question IDs, stored answers, actuals, and Race Data evidence are unchanged.

## Capabilities

### New Capabilities

- `question-definitions`: Database-backed glossary terms, public definitions, scoped tooltip matching, and shared rendering behavior.

### Modified Capabilities

- `admin-interface`: Add the Definitions Inputs section and protected definition management actions.
- `localized-interface`: Store and render definition labels and explanations through the active locale with a documented fallback.

## Impact

- PostgreSQL schema and migration/seed code for definitions, translations, aliases, and question bindings.
- Public Questions, Responses, About, and new Definitions templates/routes.
- Admin Inputs navigation, route model, table, and edit workflow.
- Shared tooltip/highlighting helper and its unit, route, accessibility, and Playwright coverage.
- Existing question and race-data scoring flows remain read-only consumers of this metadata and require no data rewrite.
