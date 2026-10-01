## Why

Race Data is intentionally editable, so an admin can encounter a round whose persisted evidence no longer matches the upstream source. There is currently no explicit, safe way to re-fetch one round; the admin must rely on a broader season sync or manual correction, which makes source drift difficult to resolve and risks touching unrelated rounds.

## What Changes

- Add a protected `Refresh source` action to the selected Race Data round.
- Reuse the canonical OpenF1/session import and derivation pipeline in a single-round mode instead of adding a second importer.
- Store each refresh as a new immutable provider evidence revision, preserving existing provider and admin-correction revisions.
- Re-derive the selected round's actual snapshot and leave it pending review; never publish a source refresh automatically.
- Keep the action separate from full-table editing and require an explicit confirmation before the network/database mutation.
- Report refresh failures without creating a partial revision and record the refresh in the existing admin event log.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-race-result-review-workspace`: add a selected-round source refresh action with clear pending-review behavior and preserved revision history.
- `actuals-sync-review`: define single-round source refresh as an immutable, pending evidence/actuals revision that does not silently publish or overwrite prior corrections.

## Impact

- The existing backfill/auto-update runner gains a single-round option.
- Admin Race Data route, toolbar template, shared CSS, and focused route tests gain the refresh action.
- Evidence revision metadata, actual snapshot derivation, and admin audit logging are reused; no schema migration or new provider dependency is required.
