## Context

The current admin Questions route edits global `question_settings`, while the Actuals route builds a read-only matrix from season snapshots. Both views already use the same question IDs and Race Data links, but they have separate page shells and the settings table has no season key. See `proposal.md` and the two delta specs for the user-visible contract.

## Goals / Non-Goals

**Goals:**

- Make one season-aware admin workspace the primary entry point for question configuration and derived question results.
- Keep source evidence and corrections owned by Race Data, and keep Results read-only.
- Introduce a durable season-question settings store with a safe migration from the current global table.
- Make all question loading, derivation display, prediction forms, and current-season scoring resolve the selected season consistently.
- Preserve stable question IDs, stored answers, actual snapshots, published pointers, and existing deep links.

**Non-Goals:**

- Creating arbitrary new question definitions from the admin UI; new definitions still enter the shared catalog/code contract first.
- Changing the Race Data evidence model or derivation algorithms.
- Editing actual answer values from the Results view.
- Rewriting historical response or scoring records during migration.

## Decisions

### One workspace, two explicit views

Use `/admin/questions` as the canonical workspace route with `view=questions|results` and `season=<year>`. Render one shared page shell containing the season selector and a bordered segmented toggle. The Questions view includes the existing inline editor and reorder controls; the Results view reuses the existing bounded actuals matrix and links back to Race Data. `/admin/actuals` remains a compatibility entry point that redirects to `view=results`.

This is preferable to embedding one full page inside another: the shell is shared, while mutation and read-only content remain separate partials and forms.

### Store season overrides in a new keyed table

Add `season_question_settings` keyed by `(season, question_id)` with the same editable fields currently supported by `question_settings`: `included`, `points_override`, `order_index`, `prompt_override`, and `updated_at`. Keep the catalog in `questions.json` as the source of stable IDs, contract metadata, and default values.

The old `question_settings` table is read only by a one-time idempotent migration that copies its rows to the active season. Application reads and writes use the season table after migration. The legacy table remains untouched for rollback/audit safety in this change and can be removed in a later cleanup once production has been verified.

### Defaults and initialization

If a season has no rows in the season table, the loader returns catalog defaults (all catalog questions included in source order) without inventing settings. The first save for that season writes a complete normalized set. The active season receives a copied configuration during startup migration so existing 2026 behavior is unchanged.

### Season-aware question loading

Extend the existing question loader with an optional `season` option while preserving its current call signature. All admin selected-season calls pass the explicit season. Public prediction, response, and leaderboard paths use the configured current season. The loader continues to apply locale translations after season overrides and keeps contract metadata read-only.

### Results derive from the same resolved question set

The Results view calls the same season-aware question loader used by the Questions view, then passes that list to the existing snapshot overview builder. This filters excluded questions without copying derivation logic. Race Data remains the source-review link target; no second result-editing path is introduced.

### Compatibility and terminology

The admin navigation exposes one Questions & Results link. Existing Questions and Actuals URLs remain valid through query normalization/redirects, including `mode=edit`, season, and supported focus context. The UI uses `Questions` and `Results`/`Question results`; internal `actuals` names and database tables remain compatibility details.

### Validation and tests

Add unit tests for season settings resolution, migration idempotence, per-season inclusion/order/points, and stable IDs. Add route/template tests for view/season query state, compatibility redirects, and read-only Results. Add a Playwright/CUA smoke path that switches seasons and views, edits order in Questions, and verifies the Results matrix changes its question rows without mutating source evidence.

## Risks / Trade-offs

- [Risk] Existing global settings might be copied into the wrong season during first boot. → [Mitigation] Copy only into the configured active season, make the migration idempotent, and assert the effective 2026 settings before serving the workspace.
- [Risk] A question excluded from a season could still be scored by an old code path. → [Mitigation] centralize `getQuestions({ season })`, update admin/leaderboard/derivation entry points, and add a regression test that excluded IDs do not reach prediction or Results rows.
- [Risk] Keeping the legacy table temporarily creates a second physical store. → [Mitigation] make it migration-only, add an explicit comment/telemetry marker, and schedule removal after production verification rather than risking data loss now.
- [Risk] Existing Actuals bookmarks lose context during redirect. → [Mitigation] preserve season and supported query parameters and test the compatibility route.

## Migration Plan

1. Add the season settings table to SQLite and PostgreSQL schemas.
2. On startup, copy existing global settings to the active season only when that season has no rows; never overwrite an existing season configuration.
3. Deploy the shared workspace and season-aware loader to the isolated preview; verify 2026 question order, points, result rows, and answer/leaderboard counts.
4. Create or seed a small 2027 catalog configuration in preview, exclude one existing question, and confirm 2026 remains unchanged.
5. After review, promote the implementation; retain the legacy table until a separate cleanup has verified all environments.

