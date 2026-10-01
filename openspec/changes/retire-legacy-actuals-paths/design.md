## Context

The canonical import path already persists provider evidence in `race_data_snapshots`, derives reviewable values into `actual_snapshots`, and exposes publication through the Actuals page. `src/routes/admin.js` still contains a separate provider-fetching implementation used only by the “Preview autofill in form” action.

## Goals / Non-Goals

**Goals:**

- Make the persisted evidence sync the only admin synchronization entry point.
- Remove the duplicated provider fetch, HTML parser, and form-prefill path.
- Keep manual correction, review, publication, and participant data intact.

**Non-Goals:**

- Do not delete database tables or migrate participant responses.
- Do not change the derivation rules, provider adapter, scoring behavior, or production deployment.
- Do not remove test-only fixture helpers or historical snapshot storage.

## Decisions

1. Remove the legacy route and its action from the UI instead of redirecting it to a second implementation. A single visible action avoids two meanings of “autofill” and makes the persisted evidence boundary explicit.
2. Delete only helpers whose sole caller is the retired route. Shared snapshot and scoring services remain untouched.
3. Retain all schema tables and existing rows. This is a code-path retirement, not a destructive data migration; answers and historical actuals remain recoverable.
4. Add a route/template regression assertion and run the full test suite before rebuilding the isolated preview.

## Risks / Trade-offs

- **[Risk]** A hidden caller may still depend on the legacy endpoint. → Search the repository and add a route-level regression check before removal.
- **[Risk]** Removing the parser may hide a provider behavior still needed elsewhere. → Confirm every removed helper is referenced only by the legacy route; provider parsing remains in the dedicated adapter/import boundary.
- **[Risk]** An existing admin loses a convenient draft-prefill button. → The canonical sync action still creates a pending snapshot for review, which is safer and reproducible.

## Migration Plan

1. Commit the OpenSpec proposal and design/spec artifacts.
2. Remove the route, UI action, translation keys, and exclusively-owned helpers.
3. Run syntax, focused admin/actuals tests, full tests, and strict OpenSpec validation.
4. Rebuild the existing isolated preview in place so its PostgreSQL state is preserved.
5. Verify health and the Actuals review flow; production remains unchanged.

