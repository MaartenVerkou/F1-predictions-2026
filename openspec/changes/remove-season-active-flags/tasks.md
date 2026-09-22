## 1. Schema and membership model

- [ ] 1.1 Remove driver/team activity columns from fresh SQLite and PostgreSQL schema definitions and add forward-only startup normalization for existing development databases.
- [ ] 1.2 Update season input repository helpers and catalog projections so season row existence represents membership and no activity fields are accepted or returned.
- [ ] 1.3 Add model tests for temporary assignment gaps, replacement intervals, membership validation, and cleanup of unreferenced inactive legacy rows during normalization.

## 2. Lineup and mutation behavior

- [ ] 2.1 Remove activity-based filters from lineup projection and application while retaining season-membership and duplicate-seat validation.
- [ ] 2.2 Replace driver/team soft-deactivation removal with history-safe season membership deletion; preserve canonical entities and reject removal when assignments reference the member.
- [ ] 2.3 Remove activity request parsing and writes from admin entity, add, remove, and seed/preview fixture flows.
- [ ] 2.4 Add route-level tests for successful unreferenced removal, protected referenced removal, and absence of `season_active` mutation behavior.

## 3. Inputs UI and localization

- [ ] 3.1 Remove Active columns, Active checkboxes, and activity fields from Drivers and Teams templates and simplify table column spans and editor markup.
- [ ] 3.2 Remove obsolete activity translations and update rendered-view assertions for roster membership and assignment-based status.

## 4. Verification and preview

- [ ] 4.1 Run syntax checks, focused tests, full Node 22 tests, and strict OpenSpec validation.
- [ ] 4.2 Rebuild the sanitized PostgreSQL preview from the exact implementation commit and verify schema, health, and selected-season Inputs flows.
- [ ] 4.3 Verify temporary sidelining/replacement display and protected roster removal in the preview browser; leave production unchanged.
