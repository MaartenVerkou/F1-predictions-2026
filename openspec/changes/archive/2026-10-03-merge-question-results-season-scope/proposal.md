## Why

Questions and their derived season results are currently split across two admin pages, while both are read in the context of the same question definitions and scoring contracts. The `Actuals` label is also ambiguous in the UI, and the current global question settings cannot express a different question set for a future season.

## What Changes

- Add one admin Questions & Results workspace with a shared season selector and a segmented `Questions` / `Results` view switch.
- Keep question editing, ordering, scoring overrides, and inclusion in the Questions view; keep derived result review read-only in the Results view.
- Rename the user-facing `Actuals` label to `Results` or `Question results` while preserving the existing `/admin/actuals` route as a compatibility entry point.
- Make question settings season-scoped, including included/excluded state, order, prompt overrides, and scoring overrides, while preserving stable question IDs and contract metadata.
- Migrate existing global question settings into the active season without changing current answers, published snapshots, or scoring history.
- Ensure derivations, result overviews, prediction forms, and scoring use the selected season's question set consistently.
- Keep Race Data as the canonical evidence and correction workspace; result cells continue linking to the relevant Race Data view.

## Capabilities

### New Capabilities
- `season-question-sets`: Manage a season-specific question membership and configuration while retaining a shared stable question catalog.
- `question-results-workspace`: Present question configuration and derived question results in one season-aware admin workspace with compatible deep links.

### Modified Capabilities
- None. Existing Race Data evidence and Actuals snapshot contracts remain the underlying data and review boundaries; this change adds a season-aware presentation and configuration layer around them.

## Impact

- PostgreSQL schema and startup migration for season-scoped question settings.
- Question loading, admin question editing, derivation/scoring inputs, and season actuals overview construction.
- Admin routes, navigation, localized labels, templates, responsive styles, and client-side view switching.
- Existing `/admin/questions` and `/admin/actuals` links remain valid through redirects or view aliases.
- Existing stored responses, actual snapshots, published scoring pointers, and stable question IDs must remain intact.
