## 1. Proposal and schema foundation

- [x] 1.1 Add additive SQLite/PostgreSQL schema for normalized `race_data_snapshots` bundles and the nullable link from `actual_snapshots`.
- [x] 1.2 Add shared helpers to normalize, serialize, load, and summarize race evidence with explicit coverage states.
- [x] 1.3 Add ADR 0002 documenting persisted normalized race evidence and link it from the design.

## 2. Sync and preview data

- [x] 2.1 Extend the season backfill/sync pipeline to build and persist one source bundle per completed round while preserving existing actual and review behavior.
- [x] 2.2 Ensure unchanged snapshots retain review metadata while updating their evidence association, and ensure missing sources are represented as incomplete rather than zero.
- [x] 2.3 Extend the sanitized preview fixture with deterministic race evidence for matrix and detail states without reading production data.

## 3. Admin audit workspace

- [x] 3.1 Add the admin-only GET route and view-model for the Race data workspace, including driver and constructor matrices, selected round, source coverage, and actuals links.
- [x] 3.2 Add the Race data template, navigation item, translations, result/status legend, and bounded responsive matrix/detail styling.
- [x] 3.3 Add selected-round detail rendering for race, qualifying, sprint, standings, provenance, incomplete, cancelled, and future states.

## 4. Verification

- [x] 4.1 Add unit tests for evidence normalization, persistence, coverage states, and snapshot linkage.
- [ ] 4.2 Add route/integration tests for admin access, read-only behavior, matrices, selected-round detail, and missing-source states.
- [ ] 4.3 Run OpenSpec strict validation, `checks.fast`, build/release checks where the environment supports them, and preview smoke checks.
- [ ] 4.4 Mark the change complete only after the preview is refreshed and the user has reviewed the new workspace.
