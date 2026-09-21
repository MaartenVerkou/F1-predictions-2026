## 1. Proposal and schema foundation

- [x] 1.1 Add additive SQLite/PostgreSQL schema for normalized `race_data_snapshots` bundles and the nullable link from `actual_snapshots`.
- [x] 1.2 Add shared helpers to normalize, serialize, load, and summarize race evidence with explicit coverage states.
- [x] 1.3 Add ADR 0002 documenting persisted normalized race evidence and link it from the design.
- [ ] 1.4 Add import-batch metadata and additive source links from derived snapshots.

## 2. Import and derivation

- [ ] 2.1 Refactor sync to create an import batch and persist normalized round bundles before deriving actuals.
- [ ] 2.2 Derive values by loading persisted bundles through the cutoff; preserve review state and mark reconstructed historical imports.
- [ ] 2.3 Add comparison output/tests for existing-vs-derived values before activation.

## 3. Admin audit workspace

- [x] 3.1 Add the admin-only GET route and view-model for the Race data workspace, including driver and constructor matrices, selected round, source coverage, and actuals links.
- [ ] 3.2 Make the selected round a real cutoff: cumulative standings and points must come from that bundle; mute future rounds.
- [ ] 3.3 Place Race data before Actuals and show import/cutoff state with compact selected-round detail.

## 4. Preview and verification

- [ ] 4.1 Extend the sanitized preview fixture across R1-R14 with deterministic complete, partial, future, cancelled, and reconstructed states.
- [ ] 4.2 Add route/integration and pure tests for import persistence, persisted derivation, cutoff totals, access, read-only behavior, and missing-source states.
- [ ] 4.3 Run OpenSpec strict validation, `checks.fast`, build/release checks where supported, and preview smoke checks.
- [ ] 4.4 Mark the change complete only after the preview is refreshed and the user has reviewed the new workspace.
