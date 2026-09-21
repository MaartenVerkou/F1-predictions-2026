## Why

Admins can review the interpreted actuals that drive scoring, but they cannot inspect the complete race evidence that produced those values. A season-wide, read-only audit workspace is needed now so missing results, retirement statuses, qualifying data, sprint data, and standings can be detected before a snapshot is accepted.

## What Changes

- Add an admin-only Race data audit workspace at `/admin/race-data`.
- Persist a normalized source-evidence bundle for each synced season round, including race classifications, statuses, grid positions, qualifying, sprint results, standings, source metadata, and coverage state.
- Show a compact drivers-by-race matrix with textual result/status cells and a constructors-by-race points matrix.
- Add a selected-race detail view with driver, constructor, grid, qualifying, sprint, race, status, and points fields.
- Link audit evidence to the corresponding derived actual snapshot and the existing Actuals review page.
- Add explicit empty, incomplete, cancelled, and unavailable-source states.
- Keep the audit workspace read-only; it must not change live actuals, snapshots, or review status.
- Seed only deterministic sanitized evidence in public previews; do not copy production source data or secrets.

## Capabilities

### New Capabilities

- `admin-race-data-audit`: Read-only season matrices and selected-round evidence for validating the data used to derive actuals.

### Modified Capabilities

- `actuals-sync-review`: Season sync also retains the source evidence used for each derived round snapshot.
- `admin-interface`: Admin navigation exposes the Race data audit workspace.

## Impact

- Adds additive SQLite/PostgreSQL schema for persisted race evidence and a link from derived snapshots to their source bundle.
- Extends the season sync/backfill path and sanitized preview fixture.
- Adds admin route, view, translations, styles, and focused tests.
- No public route, scoring rule, production database clone, or production deployment is introduced.
