## Context

The sync already fetches race results, qualifying, sprint results, standings, and manual external values to derive round actuals. It currently keeps those rows in memory and writes only derived values. The compact Actuals review is now the stable mutation workflow; this change adds a read-only evidence workflow and makes the persisted evidence the source of truth for derivation.

## Goals / Non-Goals

**Goals:**

- Persist one coherent import batch with one normalized bundle per season round.
- Make a derivation reproducible from stored bundles through a round cutoff.
- Preserve source state, coverage, calendar state, parser version, and reconstruction provenance.
- Present compact driver and constructor matrices plus selected-round details and cumulative cutoff totals.
- Keep source inspection separate from scoring mutations and preserve the existing Actuals review actions.
- Support SQLite preview/test databases and PostgreSQL production without copying production data into previews.

**Non-Goals:**

- Replacing the Actuals editor or review action.
- Re-fetching external sources whenever an admin opens the page.
- Building a public race-results page.
- Changing scoring rules or silently repairing missing source data.
- Persisting provider-specific raw HTML when normalized fields are sufficient.

## Decisions

### 1. Import batch is the unit of provenance

Add a `race_data_imports` table with an id, season, lifecycle status, started/completed timestamps, source type, parser version, requested/completed rounds, reconstruction flag, and human-readable note. A sync first creates one import row, then stores every normalized round bundle with that import id. The import is marked completed only after all fetch/persist work succeeds; failed imports remain inspectable with an error state.

Add nullable `source_data_import_id` and `source_data_snapshot_id` columns to `actual_snapshots`. The pair identifies the batch and exact round evidence used by the derived values. Existing rows remain valid and are treated as legacy/no-captured-evidence.

### 2. Persist normalized evidence before deriving

`race_data_snapshots` remains JSON-backed for provider-neutral normalized fields, but each row belongs to an import id and carries calendar state and coverage. The import path writes bundles first. Derivation then loads bundles from the database up to the requested cutoff, reconstructs the same calculation input shape, and calls the existing question serialization rules. It never derives directly from the provider response object.

For historical backfills where the original source capture is absent, the import is marked `reconstructed`, with the current fetch timestamp and source note. The result is explicitly not presented as the original historical capture. Existing reviewed snapshot metadata is preserved when derived values are unchanged.

### 3. Cutoff-aware audit model

The Race data page selects a round cutoff. Matrix cells for rounds after the cutoff are muted as future; cells through the cutoff use persisted evidence. Driver and constructor summary columns use standings from the selected cutoff bundle, not the latest available bundle. The selected detail panel shows calendar/import/coverage state, source timestamp, the round evidence, and a link to Actuals.

### 4. Two matrix tabs plus one detail table

The Drivers tab shows drivers by race with classified result/status cells. The Constructors tab shows constructor race points. The selected-round detail table combines grid, qualifying, sprint, race, status, and points so the admin can validate all actual-relevant inputs without separate dense tables.

### 5. Read-only audit route

`GET /admin/race-data` is admin-only and has no mutation form. It accepts only view/cutoff selection and links to the existing Actuals review target. CSRF/mutation protection remains unchanged because the page does not write.

### 6. Sanitized preview fixture

The preview seed creates a deterministic import batch covering the configured season through R14 with fictionalized driver/team names and deliberate partial/future/cancelled states. It never queries or copies production. This makes cutoff totals, incomplete coverage, and missing evidence visible before preview approval.

## Risks / Trade-offs

- **Historical rows have no source evidence** → mark them legacy/reconstructed/unavailable; do not fabricate old rows.
- **Provider data changes after a later import** → keep a separate import id and link each derived snapshot to the exact batch/round.
- **JSON payload size** → store only normalized fields needed for audit and derivation.
- **Alias drift** → normalize against the roster and mark unmapped/partial coverage.
- **A failed feed could look like zero** → carry per-source coverage and render explicit unavailable/status tokens.
- **Wide tables on phones** → bounded horizontal scrolling with sticky identity columns and a selected-round detail view.

## Related Decision

The persistence choice is recorded in ADR 0002, “Persist normalized race source evidence.”
