## 1. Source policy and contracts

- [x] 1.1 Add provider-policy tests proving OpenF1 owns official session/grid facts, Jolpica/Ergast owns standings, and destructors costs remain a separate source.
- [x] 1.2 Add canonical session contract tests for normal weekends, sprint weekends, cancelled sessions, unresolved drivers, and sentinel statuses.
- [x] 1.3 Add configuration validation that rejects Formula 1 Dashboard as the standard-results provider with an actionable migration error.

## 2. OpenF1 session adapter

- [x] 2.1 Implement a bounded, retrying OpenF1 client for meetings, sessions, session results, driver metadata, and starting grids with endpoint provenance.
- [x] 2.2 Normalize OpenF1 session names/types into practice1/practice2/practice3/sprintQualifying/sprint/qualifying/startingGrid/race rows with provider identities and timing/status fields.
- [x] 2.3 Resolve OpenF1 meeting keys to the selected season calendar by name, circuit, and date; report unmatched or ambiguous meetings without guessing.
- [x] 2.4 Add adapter fixtures and tests for normal weekends, sprint weekends, cancelled/future sessions, replacement drivers, rate limits, malformed payloads, and qualifying-vs-sprint-qualifying classification.

## 3. Canonical persisted evidence

- [x] 3.1 Extend the normalized evidence contract and coverage summary with the generic sessions map, session provenance, unavailable/cancelled reasons, and reconstructed imports.
- [x] 3.2 Add dual-read/canonical-write support so existing race, qualifying, and sprint payloads are exposed through the sessions map without changing current page behavior.
- [x] 3.3 Update evidence derivation, Race Data projections, and Actuals inputs to read the canonical sessions map and preserve the existing review/publish lifecycle.
- [ ] 3.4 Add migration/parity tests proving existing snapshots, participant answers, reviewed Actuals, and corrections remain unchanged when session fields are reserialized.

## 4. Backfill and future synchronization

- [x] 4.1 Add a dry-run/apply session backfill command with reconstructed provenance, provider/session idempotency, conflict reports, and per-round coverage output.
- [ ] 4.2 Merge missing OpenF1 sessions into the effective evidence revision without silently overwriting reviewed facts; create pending derived Actual revisions when required.
- [ ] 4.3 Add a session-completion sync worker for future rounds with retry, cancellation handling, partial coverage, and no live provider calls from rendering/scoring.
- [ ] 4.4 Run a 2026 completed-round dry-run, compare OpenF1 sessions to current evidence and Jolpica standings, and record the accepted reconciliation report.

## 5. UI and provider cleanup

- [x] 5.1 Show populated practice/sprint-qualifying columns and compact session coverage/provenance in Race Data without duplicating source text.
- [x] 5.2 Remove the generic Formula 1 Dashboard standard-results selector and obsolete duplicate race/qualifying/sprint import code; retain only explicitly scoped destructors comparison/import support.
- [x] 5.3 Update documentation and operational configuration for the three-source ownership matrix and migration/rollback procedure.

## 6. Verification and release gate

- [ ] 6.1 Run focused adapter/evidence/derivation tests and full project tests, build, strict OpenSpec validation, and critical Playwright flows.
- [ ] 6.2 Apply the backfill only to isolated preview, verify PostgreSQL health, pending Actuals, rerun idempotency, and production isolation.
- [ ] 6.3 Review the final diff for dead provider paths, duplicated transformations, secrets, and unintended participant-answer changes before merge.
