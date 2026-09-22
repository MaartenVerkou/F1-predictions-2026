## 0. Finish the Inputs foundation

- [ ] 0.1 Add the remaining canonical-season-inputs tests for renames, provider aliases, ambiguous mappings, legacy values, round cutoffs, cross-season isolation, and seat occupancy.
- [ ] 0.2 Add the remaining race-data audit comparison and route/integration tests for persisted evidence, missing-source states, read-only access, and cutoff totals.
- [ ] 0.3 Add archived Inputs mutation lifecycle tests for confirmation/no-confirmation paths and run strict OpenSpec validation plus the supported project checks.
- [ ] 0.4 Refresh the sanitized preview at the exact feature commit, verify PostgreSQL health and the Inputs → Questions → Race data → Actuals flow, then document approval before archiving prior changes.

## 1. Catalog contract and readiness

- [ ] 1.1 Implement a shared season catalog read model that returns canonical entities, memberships, assignments, mappings, season-specific metadata, and a stable semantic revision.
- [ ] 1.2 Add readiness diagnostics for identity uniqueness, calendar integrity, assignment overlap, mapping resolution, and question-option resolution; expose compact admin diagnostics without duplicating metadata.
- [ ] 1.3 Make downstream callers accept an explicit catalog revision and add unit/integration tests for rename, mid-season swap, provider alias, and cross-season isolation behavior.
- [ ] 1.4 Record the catalog revision in audit events and establish a migration/report for unresolved legacy values without silently rewriting ambiguity.

## 2. Evidence import boundary

- [ ] 2.1 Extend normalized evidence identity and schema with explicit race identity, source revision, parser version, cutoff, and unresolved-row reasons.
- [ ] 2.2 Make import persistence idempotent for equivalent bundles and create a new evidence revision only when normalized facts or parser behavior changes.
- [ ] 2.3 Add pure and integration tests for complete, partial, cancelled, future, reconstructed, duplicate, and changed imports.
- [ ] 2.4 Route Race data and Actuals to the same persisted evidence/cutoff read model and verify that future data cannot leak into earlier rounds.

## 3. Shared derivation engine

- [ ] 3.1 Extract question derivation into a season-aware service with strategy metadata, canonical outputs, unavailable reasons, and provenance.
- [ ] 3.2 Replace hardcoded 2026 roster/engine/team-pair constants with catalog/assignment/season metadata or explicit versioned strategy configuration.
- [ ] 3.3 Make admin sync and the backfill command thin callers of the same derivation service; keep an old-vs-new comparison report until parity is proven.
- [ ] 3.4 Add tests for driver/team changes, constructor standings, teammate questions, sprint/qualifying data, cancelled rounds, unresolved inputs, and round cutoffs.

## 4. Season-scoped actual lifecycle

- [ ] 4.1 Add additive schema for snapshot provenance, season-scoped published actuals, explicit corrections, and review transitions.
- [ ] 4.2 Implement dual-read/canonical-write behavior and migrate current live actual reads/writes without changing reviewed historical snapshots.
- [ ] 4.3 Update Actuals UI and review actions to show one compact source/revision state, publish only reviewed snapshots, and preserve correction history.
- [ ] 4.4 Add tests for unchanged re-sync, changed re-sync, manual correction, no-published-actuals, and multi-season isolation.

## 5. One scoring service

- [ ] 5.1 Consolidate scoring implementations behind the shared canonical scoring service and remove route-level duplicates after parity tests pass.
- [ ] 5.2 Make leaderboard, analysis, admin breakdowns, and public views consume the selected season's published snapshot and canonical references.
- [ ] 5.3 Add reproducibility tests proving historical scoring is unchanged by later renames, lineup changes, or current-season actuals.

## 6. Read-model and UI integration

- [ ] 6.1 Update Questions to resolve options from the selected catalog revision and show unresolved options as a data-quality state.
- [ ] 6.2 Update Race data to display normalized evidence/provenance and the same selected cutoff used by Actuals.
- [ ] 6.3 Update Actuals, leaderboard, and analysis to consume shared services and remove duplicated semantic transformations.
- [ ] 6.4 Keep loading, empty, error, permission, responsive, and accessibility states coherent across the four admin/public workflows.

## 7. Preview, release, and cleanup

- [ ] 7.1 Add coherent sanitized fixtures for multiple seasons, a mid-season driver replacement, renamed entities, unresolved mappings, and incomplete evidence.
- [ ] 7.2 Run syntax, focused tests, full tests, build, strict OpenSpec validation, and critical Playwright flows on the preview branch.
- [ ] 7.3 Verify `/healthz` reports PostgreSQL, production remains unchanged, and the preview shows reproducible Inputs → Questions → Race data → Actuals → scoring behavior.
- [ ] 7.4 Remove superseded route/script implementations and archive this change only after explicit preview approval and a clean final diff review.
