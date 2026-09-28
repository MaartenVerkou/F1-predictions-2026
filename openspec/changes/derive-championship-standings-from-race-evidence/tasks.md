## 1. Scoring rules foundation

- [ ] 1.1 Add the season-scoped scoring-rules schema and seed the effective rules for every existing season in SQLite and PostgreSQL.
- [ ] 1.2 Implement pure scoring functions for race, sprint, fastest-lap eligibility, constructor aggregation, and deterministic championship ranking.
- [ ] 1.3 Add vertical tests for season-specific rules, sprint weekends, missing rules, and driver/constructor cumulative totals.

## 2. Evidence-derived dataflow

- [ ] 2.1 Extend persisted evidence normalization to calculate points from canonical result rows while retaining provider points and legacy standings for reconciliation.
- [ ] 2.2 Make Actuals derivation, Race Data metrics, and correction re-derivation consume the shared evidence-derived standings.
- [ ] 2.3 Add reconciliation output that reports match, difference, and missing evidence without overwriting historical snapshots or published actuals.
- [ ] 2.4 Remove Jolpica standings fetches, source URLs, provider-policy entries, and new-import metadata from the active sync path; retain historical readers.

## 3. Admin presentation

- [ ] 3.1 Add `Points` and `Championship points results` variants to the shared championship table controls and keep season/round/view context when switching.
- [ ] 3.2 Render direct per-round derived points with cumulative totals and a comparison state for legacy standings.
- [ ] 3.3 Add the compact read-only scoring-rules overview to the selected-season Inputs page, including revision/source and race/sprint rule tables.

## 4. Migration and validation

- [ ] 4.1 Run a preview dry-run reconciliation over completed seasons and record any differences or missing evidence for review.
- [ ] 4.2 Backfill only derived/reconciliation metadata in preview; do not rewrite reviewed/published answer values automatically.
- [ ] 4.3 Run focused unit/integration tests, OpenSpec strict validation, and Playwright checks for Race Data, Inputs, and Actuals.
- [ ] 4.4 Review the final diff for dead Jolpica paths, duplicate scoring logic, and accidental production or user-answer changes.
