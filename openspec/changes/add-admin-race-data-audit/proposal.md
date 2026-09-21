## Why

Admins need to verify the data that was imported before trusting the actuals derived from it. The current sync fetches provider rows and immediately turns them into actuals, so an admin can see an outcome but cannot reliably inspect the persisted source state or reproduce the calculation at a historical round cutoff.

## What Changes

- Add an admin-only Race data workspace at `/admin/race-data`, placed before Actuals in admin navigation.
- Persist each import as a named, immutable-ish sync batch with normalized per-round source bundles, coverage/provenance, calendar state, and parser/source metadata.
- Make persisted normalized race data the canonical input to actual derivation: fetch/import first, then derive actual snapshots from the stored bundles through a selected round cutoff.
- Link each derived actual snapshot to both the import batch and the round evidence bundle used for it.
- Show compact drivers-by-race and constructors-by-race matrices, with a selected cutoff round and cumulative points/championship position at that cutoff.
- Add a selected-round detail view with driver, constructor, grid, qualifying, sprint, race, status, points, source state, and derived-actual link.
- Represent incomplete, cancelled, future, unavailable, and reconstructed historical imports explicitly; never turn missing evidence into zero.
- Seed only deterministic sanitized evidence across the preview season; never copy production data or secrets.
- Keep the workspace read-only and do not change production until the preview is explicitly approved.

## Capabilities

### New Capabilities

- `admin-race-data-audit`: Read-only season matrices and selected-round evidence for validating imported data and derived actuals.

### Modified Capabilities

- `actuals-sync-review`: Sync persists an import batch before deriving actuals and records the exact source batch/round used.
- `admin-interface`: Admin navigation exposes Race data before Actuals.

## Impact

- Adds additive SQLite/PostgreSQL schema for import metadata, normalized race bundles, and source links from derived snapshots.
- Refactors the season sync/backfill path to import, persist, then derive from persisted evidence.
- Adds cutoff-aware admin route/view, translations, styles, and focused tests.
- Historical production rows without captured evidence remain marked as reconstructed/unavailable; no production database clone or public data copy is introduced.
