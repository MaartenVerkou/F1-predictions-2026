## Context

Canonical race evidence is already persisted per round, but the active sync still adds a second standings source. The Race Data and Actuals routes then read `payload.standings` and use provider totals for ordering and question derivation. Existing snapshots and published answer sets must remain readable while new syncs become independent of Jolpica.

## Goals / Non-Goals

**Goals:**

- Make persisted race and sprint result rows the only new source for championship points.
- Make scoring rules explicit, season-scoped, inspectable, and testable.
- Preserve a comparison path between old imported standings and newly derived results.
- Reuse one derivation module from backfill, Race Data, Actuals, and public scoring.
- Remove Jolpica from active provider policy and imports without deleting historical provenance.

**Non-Goals:**

- Reconstructing or rewriting already published user answers.
- Changing the existing question catalog or response storage format.
- Adding a public scoring-rules editor in this change; the first UI is read-only and seeded.
- Replacing the approved Driver of the Day or Destructors sources.

## Decisions

1. **Persist season rules in a normalized table.** Add a season-scoped rules revision with JSON point tables and explicit fastest-lap/constructor policies. A table works for SQLite and PostgreSQL, supports future seasons, and avoids hidden code constants. A JSON file alone was rejected because admins could not inspect the effective database revision and deployments could drift.

2. **Derive, then reconcile.** Introduce pure scoring/standings functions that accept result rows and a rules revision. The result row keeps the provider-awarded point value as provenance, while the derived value is calculated from position/status/markers. Existing `payload.standings` is retained as legacy comparison data; new `derivedStandings` is the calculation used by Actuals and Race Data. Differences are reported, not silently overwritten.

3. **Use one table variant registry.** Keep the existing Drivers/Constructors table shell and add two point metrics: `Points` for per-round derived points plus cumulative total, and `Championship points results` for the cumulative ranked result/reconciliation. Variant changes remain client-side/fragment-safe and preserve season and round.

4. **Fail closed on missing rules/evidence.** A missing scoring revision or required result session produces an explicit incomplete state and prevents publication. This is safer than falling back to Jolpica or guessed defaults.

5. **Remove only active Jolpica behavior.** Delete it from standard provider policy, backfill fetches, source URLs, and new snapshot metadata. Keep historical source strings, old snapshots, and compatibility readers so audits and existing answers remain intact.

## Risks / Trade-offs

- **Historical differences:** Derived totals may not match old Jolpica standings. The reconciliation variant makes this visible and blocks automatic publication until reviewed.
- **Provider row gaps:** OpenF1 can omit a session or classify a result differently. Evidence coverage and incomplete states prevent silent scoring.
- **Rule evolution:** A future season may add a new scoring rule. The versioned rules shape and explicit validation make unsupported fields fail rather than being ignored.
- **Migration complexity:** Existing snapshots were written with provider standings. The loader will normalize both legacy and derived payloads so no destructive migration is required.

## Migration Plan

1. Create/seed the season-scoring-rules table for existing seasons and display its effective revision in Inputs.
2. Add pure scoring and standings derivation with contract tests, while keeping legacy standings available for comparison.
3. Switch backfill and actual derivation to evidence-derived standings and run a dry-run reconciliation for completed preview rounds.
4. Add the two Race Data point variants and expose match/difference/missing states.
5. Remove Jolpica from active policy/fetch paths, run focused tests and Playwright checks, then apply the preview migration.
6. Publish only after an admin confirms the reconciliation; production remains untouched until an explicit release.

Rollback is code-level: revert the active provider/derivation commit. Existing snapshots and legacy standings remain in the database, so no data rollback or destructive migration is needed.

## Open Questions

- Whether admins should be able to edit scoring rules in a later Inputs change; this release only needs inspection and seeded revisions.
