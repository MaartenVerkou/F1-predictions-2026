## Why

Championship totals are still imported from Jolpica even though the application already persists the race, sprint, and qualifying evidence that determines those totals. That creates a second authority, makes provider outages affect scoring, and makes it impossible to explain season-specific scoring rules in the admin UI. This change makes persisted race evidence the authority and gives admins a visible, season-aware points contract plus a comparison view while the migration is validated.

## What Changes

- **BREAKING** Remove Jolpica/Ergast from the active race-data and actuals sync pipeline; no new standings or points are fetched from it.
- Derive driver and constructor championship points cumulatively from persisted Grand Prix and sprint result rows.
- Store and apply a scoring-rules revision per season, including race, sprint, fastest-lap eligibility, and constructor aggregation rules.
- Add a read-only scoring-rules overview to the season Inputs area so the rule set used for a season is inspectable.
- Add a Championship points results comparison variant alongside the direct Points variant in the Race Data championship table.
- Keep the existing stored championship snapshot values readable and expose a reconciliation result (match, difference, or missing evidence) before replacing their derived source.
- Ensure Actuals derivation consumes the same evidence-derived championship totals as Race Data and scoring, while preserving reviewed answers and historical snapshots.
- Keep historical provenance and answer data intact; old Jolpica references may remain only as historical comparison metadata and must not be used for new calculations.

## Capabilities

### New Capabilities

- `season-scoring-rules`: Season-scoped, inspectable scoring rules and a compact admin overview of race, sprint, fastest-lap, and constructor aggregation rules.
- `championship-points-audit`: Evidence-derived championship points, direct-vs-cumulative table variants, and reconciliation status for migration validation.

### Modified Capabilities

- `actuals-sync-review`: Actuals snapshots are derived from persisted canonical race evidence and no longer require an external championship-standings provider.

## Impact

- Affected code includes the canonical evidence normalizer, backfill/sync script, derivation and Race Data review model, admin Race Data and Inputs routes, and provider policy.
- A season-scoring-rules persistence table/migration and seed data are required for SQLite and PostgreSQL.
- Existing actual snapshots, published sets, responses, and review history remain readable and are not deleted.
- OpenF1 remains the session/result source, Formula1.com remains the Driver of the Day source, and the approved Reddit destructors source remains separate; Jolpica is removed from standard sync.
