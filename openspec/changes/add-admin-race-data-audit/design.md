## Context

The existing season sync already fetches race results, qualifying, sprint results, and standings to derive round actuals, but it currently discards the source rows after calculating values. The existing `actual_snapshots` and `actual_snapshot_values` tables therefore cannot explain why a derived value was produced. The completed compact Actuals review is now the stable editing workflow; this change adds a read-only evidence workflow beside it.

## Goals / Non-Goals

**Goals:**

- Preserve the evidence used by a sync so the audit view is deterministic and reproducible.
- Present a compact driver matrix, a constructor points matrix, and a selected-round detail table.
- Make missing, cancelled, future, and partial source states explicit.
- Keep source inspection separate from scoring mutations and preserve the existing Actuals review actions.
- Support both SQLite preview/test databases and PostgreSQL production without copying production data into previews.

**Non-Goals:**

- Replacing the existing Actuals editor or review action.
- Re-running external fetches every time an admin opens the page.
- Building a public race-results page.
- Adding new scoring rules or changing how actual values are calculated.
- Persisting provider-specific raw HTML when a normalized evidence field is sufficient.

## Decisions

### 1. Store one normalized source bundle per sync round

Add a `race_data_snapshots` table with one row per season/round/sync evidence bundle. Store normalized evidence as JSON text so both SQLite and PostgreSQL can use the same persistence path. Include source type, source URLs/notes, fetched timestamp, parser version, coverage status, and the normalized payload.

Link the derived `actual_snapshots` row to the source bundle with an additive nullable foreign-key-style identifier. When a re-sync produces unchanged values, preserve review metadata while updating the usable evidence link. When values change, create the normal pending snapshot and link it to the new bundle.

This keeps source evidence separate from derived scoring values while avoiding a large number of provider-specific tables. It also makes the exact bundle used for an actual snapshot inspectable.

### 2. Normalize the fields needed by actuals

The persisted bundle contains stable fields rather than provider-specific objects:

- race rows: driver, constructor, grid, classified position, status, race points, pole/fastest-lap markers when available;
- qualifying rows: driver, constructor, qualifying position;
- sprint rows: driver, constructor, position, status, points;
- standings after the round: driver/constructor, position, points;
- provenance: source label/URL, fetched time, coverage flags, and parser version.

Names are normalized through the existing roster aliases before storage. The UI renders explicit status tokens and does not infer zero from an absent row.

### 3. Use two matrix tabs plus one selected-round detail

The default Drivers tab shows drivers by configured race column with classified result/status cells and a cumulative summary. The Constructors tab shows constructor points by race. Selecting a race opens the detail table containing grid, qualifying, sprint, race, status, and points together. This gives broad season coverage without duplicating a dense qualifying or sprint matrix.

The matrix uses an internal scroll region and sticky identity columns, reusing the existing admin wide-table rules. Statuses remain textual and are not color-only.

### 4. Keep the audit route read-only

The new route is a GET-only admin endpoint. Links to Actuals preserve the selected round, but no form on the audit page can write snapshots or live actuals. Existing CSRF/mutation protection remains unchanged because the page adds no mutation.

### 5. Seed sanitized preview evidence deterministically

The preview seed creates a small deterministic source bundle using sanitized fixture names/values and the configured race calendar. It must not query or copy production data. The fixture is sufficient to exercise the drivers matrix, constructors matrix, incomplete-state messaging, and selected-round detail.

## Risks / Trade-offs

- **[Historical rows have no evidence]** → Render an explicit “evidence not captured” state and populate evidence on the next approved sync; do not fabricate old rows.
- **[Provider data changes after a later sync]** → Keep a separate bundle per sync and link the bundle used for each derived snapshot.
- **[Large JSON payloads]** → Store only normalized fields needed for audit and actual derivation, not raw provider HTML.
- **[Driver/team aliases drift]** → Normalize through the existing roster and alias maps and show an incomplete coverage warning when a row cannot be mapped.
- **[A failed feed could look like zero]** → Carry per-source coverage flags and render missing values distinctly.
- **[Wide season tables are difficult on phones]** → Keep the table horizontally scrollable inside a bounded region, with sticky driver/constructor columns and a selected-round detail view.


## Related Decision

The persistence choice is recorded in ADR 0002, “Persist normalized race source evidence.”
