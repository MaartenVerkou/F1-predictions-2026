## 0. Finish the Inputs foundation

- [x] 0.1 Add the remaining canonical-season-inputs tests for renames, provider aliases, ambiguous mappings, legacy values, round cutoffs, cross-season isolation, and seat occupancy.
- [x] 0.2 Add the remaining race-data audit comparison and route/integration tests for persisted evidence, missing-source states, read-only access, and cutoff totals.
- [x] 0.3 Add archived Inputs mutation lifecycle tests for confirmation/no-confirmation paths and run strict OpenSpec validation plus the supported project checks.
- [ ] 0.4 Refresh the provider-backed isolated preview at the exact feature commit, verify PostgreSQL health and the Inputs → Questions → Race data → Actuals flow, then document approval before archiving prior changes.

## 1. Catalog contract and readiness

- [x] 1.1 Implement a shared season catalog read model that returns canonical entities, memberships, assignments, mappings, season-specific metadata, and a stable semantic revision.
- [x] 1.2 Add readiness diagnostics for identity uniqueness, calendar integrity, assignment overlap, mapping resolution, and question-option resolution; expose compact admin diagnostics without duplicating metadata.
- [x] 1.3 Make downstream callers accept an explicit catalog revision and add unit/integration tests for rename, mid-season swap, provider alias, and cross-season isolation behavior.
- [x] 1.4 Record the catalog revision in audit events and establish a migration/report for unresolved legacy values without silently rewriting ambiguity.

## 2. Evidence import boundary

- [x] 2.1 Extend normalized evidence identity and schema with explicit race identity, source revision, parser version, cutoff, and unresolved-row reasons.
- [x] 2.2 Make import persistence idempotent for equivalent bundles and create a new evidence revision only when normalized facts or parser behavior changes.
- [x] 2.3 Add pure and integration tests for complete, partial, cancelled, future, reconstructed, duplicate, and changed imports.
- [x] 2.4 Route Race data and Actuals to the same persisted evidence/cutoff read model and verify that future data cannot leak into earlier rounds.
- [x] 2.5 Add a validated Formula 1 Dashboard provider adapter for calendar, race, starting-grid, qualifying, sprint, driver-standings, and constructor-standings endpoints with timeout/retry and immutable provenance.
- [x] 2.6 Normalize Formula 1 Dashboard rows to the provider-neutral evidence contract, resolve stable catalog IDs where unique, and preserve provider IDs/labels plus explicit unresolved/conflict reasons.
- [x] 2.7 Make the backfill/admin sync provider-selectable through server configuration, keeping Actuals and Race data on persisted evidence and preventing live API calls during rendering or scoring.
- [x] 2.8 Add provider fixtures/tests for successful constructor mapping, sentinel statuses, partial/future rounds, malformed responses, idempotent revisions, and Formula 1 Dashboard versus existing-provider comparison output.

## 3. Shared derivation engine

- [x] 3.1 Extract question derivation into a season-aware service with strategy metadata, canonical outputs, unavailable reasons, and provenance.
- [x] 3.2 Replace hardcoded 2026 roster/engine/team-pair constants with catalog/assignment/season metadata or explicit versioned strategy configuration.
- [x] 3.3 Make admin sync and the backfill command thin callers of the same derivation service; keep an old-vs-new comparison report until parity is proven.
- [x] 3.4 Add tests for driver/team changes, constructor standings, teammate questions, sprint/qualifying data, cancelled rounds, unresolved inputs, and effective season-end boundaries.
- [x] 3.5 Derive the Drivers' title-decision answer from the selected effective season end, season scoring rules, future sprint opportunities, and countback tiebreak possibilities.
- [x] 3.6 Make the selected round a virtual season end across every question derivation, remove user-facing cutoff terminology, and add regression coverage for full-season and earlier-round projections.

## 4. Season-scoped actual lifecycle

- [x] 4.1 Add additive schema for snapshot provenance, season-scoped published actuals, explicit corrections, and review transitions.
- [x] 4.2 Implement dual-read/canonical-write behavior and migrate current live actual reads/writes without changing reviewed historical snapshots.
- [x] 4.3 Update Actuals UI and review actions to show one compact source/revision state, publish only reviewed snapshots, and preserve correction history.
- [x] 4.4 Add tests for unchanged re-sync, changed re-sync, manual correction, no-published-actuals, and multi-season isolation.

## 5. One scoring service

- [x] 5.1 Consolidate scoring implementations behind the shared canonical scoring service and remove route-level duplicates after parity tests pass.
- [x] 5.2 Make leaderboard, analysis, admin breakdowns, and public views consume the selected season's published snapshot and canonical references.
- [x] 5.3 Add reproducibility tests proving historical scoring is unchanged by later renames, lineup changes, or current-season actuals.

## 6. Read-model and UI integration

- [x] 6.1 Update Questions to resolve options from the selected catalog revision and show unresolved options as a data-quality state.
- [x] 6.1a Add a shared Questions contract read model for basis, derivation/evidence, scoring summary, catalog readiness, and actual lifecycle links.
- [x] 6.1b Replace per-row question settings/reorder submits with consistent page-level settings and order edit modes, preserving stable question IDs and answers.
- [x] 6.1c Add focused route/model tests for season isolation, unresolved options, actual lifecycle links, validated settings, and persisted order.
- [x] 6.1d Simplify Questions into one global input table with a single inline Edit mode; remove downstream Actual/readiness/link columns, add prompt overrides, validate order/points/text in one transaction, and preserve stable IDs and answers.
- [x] 6.2 Update Race data to display normalized evidence/provenance and the same selected cutoff used by Actuals.
- [x] 6.2a Add shared constructor podium metadata to the Race data matrix, including cutoff-aware position badges and accessible legend text; keep the merged constructor total points-only until a dedicated aggregate summary is designed.
- [x] 6.2b Add the in-place Drivers/Constructors view switch with grouped constructor seat rows, merged constructor totals, canonical round lineup ordering, and shared matrix row/cell partials.
- [x] 6.2c Add question-linked Race data audit projections over the shared matrix, including points and podium focus, cutoff-aware totals, metadata-driven table selection, URL state, and read-only semantics.
- [x] 6.2d Extend question-linked Race data audit projections with metadata-driven focus groups, reusable DNF/grid/sprint/qualifying metrics, compact cross-question summaries, and explicit unavailable states for unsupported evidence.
- [x] 6.2e Add shared metric render modes for per-round count/points/comparison cells and a cutoff-aware additive footer, with metadata-driven focus profiles and tests for future-round exclusion.
- [x] 6.2f Add Formula 1 Dashboard destructors component-cost evidence to the shared driver/constructor matrix and derive both destructors Actuals from the same normalized evidence path.
- [x] 6.3 Update Actuals, leaderboard, and analysis to consume shared services and remove duplicated semantic transformations.
- [x] 6.3a Add one shared bounded Actuals answer projection with entity codes, stable grouping, overflow counts, and full accessible values for long future question answers.
- [x] 6.4 Keep loading, empty, error, permission, responsive, and accessibility states coherent across the four admin/public workflows.

## 7. Preview, release, and cleanup

- [x] 7.1 Keep coherent synthetic fixtures test-only, and bootstrap the public isolated preview from validated Formula 1 Dashboard/provider evidence without a random-data fallback.
- [x] 7.2 Run syntax, focused tests, full tests, build, strict OpenSpec validation, and critical Playwright flows on the preview branch.
- [x] 7.3 Verify `/healthz` reports PostgreSQL, production remains unchanged, and the preview shows reproducible Inputs → Questions → Race data → Actuals → scoring behavior.
- [ ] 7.4 Remove superseded route/script implementations and archive this change only after explicit preview approval and a clean final diff review.
