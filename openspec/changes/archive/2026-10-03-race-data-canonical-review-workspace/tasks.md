## 1. Baseline and guardrails

- [x] 1.1 Inventory the current Race Data/Actuals routes, focus projections, evidence schema, and all correction/write paths; record participant-response and published-snapshot counts in the isolated preview.
- [x] 1.2 Run the existing race-data, persisted-derivation, actuals, and admin UI tests; commit the proposal, specs, design, and task artifacts before implementation.

## 2. Revisioned race evidence and protected corrections

- [x] 2.1 Add additive revision metadata to race-data snapshots and both PostgreSQL/SQLite schema ensure paths, including superseded snapshot, correction reason, editor, and timestamp.
- [x] 2.2 Implement a shared evidence repository/read model that selects the effective revision for a season and round and preserves prior revisions for audit.
- [x] 2.3 Implement the admin-only correction command/route with CSRF, explicit confirmation, required reason, canonical identity/status validation, and no in-place snapshot mutation.
- [x] 2.4 Add tests proving corrections create revisions, reject unauthorized/invalid edits, preserve participant responses, and leave unrelated rounds and published actuals unchanged.

## 3. Shared race-data read models and metric registry

- [x] 3.1 Define the metadata-driven metric registry for finish order, points, DNFs, podiums, qualifying, sprint, fastest-lap/pole, and supported external evidence.
- [x] 3.2 Implement one shared read model for race-result rows, driver championship rows, and constructor seat/total rows over the selected evidence revision.
- [x] 3.3 Map question definitions to metric keys and explicit driver/constructor requirements, including unavailable states for unsupported or incomplete evidence.
- [x] 3.4 Add parity tests for finish ordering, totals, cutoff behavior, driver/constructor modes, and representative question metrics.

## 4. Rebuild the Race Data workspace UI

- [x] 4.1 Replace the focus-first toolbar with aligned Season and Round selectors and a primary finish-order race-result section.
- [x] 4.2 Add the shared Drivers/Constructors and metric controls with segmented-button and narrow-screen select variants.
- [x] 4.3 Render driver and constructor championship tables below the race-result table using shared row/cell components, metric totals, unavailable states, and consistent responsive scrolling.
- [x] 4.4 Move question selection into a separate derivation-review section and remove the question selector's ability to redefine the primary fact-table layout.
- [x] 4.5 Add view/template tests and critical Playwright coverage for selector state, finish order, metric switching, responsive controls, and protected edit affordances.

## 5. Actuals derivation and overview

- [x] 5.1 Route question derivation through the selected evidence revision, catalog revision, cutoff, and metric registry; preserve provenance and unavailable reasons.
- [x] 5.2 Replace the race-matrix Actuals presentation with a compact question-by-round overview while keeping snapshot review/publish actions explicit.
- [x] 5.3 Link an Actuals cell to the corresponding Race Data derivation view and expose the protected correction/review flow without duplicating evidence tables.
- [x] 5.4 Add tests for corrected evidence, unchanged re-sync, pending/published transitions, historical revisions, and scoring parity.

## 6. Remove superseded paths

- [x] 6.1 Remove the old focus-driven primary table markup and route-level duplicate transformations after metric parity is proven.
- [x] 6.2 Remove obsolete labels, styles, helpers, and dead question-specific table branches while retaining the separate legacy-actuals cleanup boundary.
- [x] 6.3 Review all touched files for duplicate data sources, unsafe mutation paths, and participant-answer regressions.

## 7. Verification and isolated preview

- [x] 7.1 Run syntax checks, focused tests, full tests, build/assets checks, strict OpenSpec validation, and critical Playwright flows.
- [x] 7.2 Rebuild the isolated preview in place without resetting PostgreSQL; verify health, evidence counts, response counts, correction flow, Race Data views, Actuals overview, and scoring.
- [x] 7.3 Review the final diff for accidental schema/data deletion, confirm production remains unchanged, and document the preview checkpoint for approval.
