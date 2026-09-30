## 1. Season-scoped question configuration

- [ ] 1.1 Add the season-question settings table and indexes to the SQLite and PostgreSQL schemas.
- [ ] 1.2 Implement idempotent migration of legacy global question settings into the active season and add season-aware settings resolution with catalog defaults.
- [ ] 1.3 Extend question loading and admin question models to resolve inclusion, order, prompt, and scoring overrides for an explicit season.
- [ ] 1.4 Update the Questions mutation route to validate and save a complete normalized season configuration without changing stable IDs or stored answers.

## 2. Unified Questions & Results workspace

- [ ] 2.1 Add the shared workspace shell, season selector, Questions/Results toggle, and stable query-state handling.
- [ ] 2.2 Move the existing Questions editor into the workspace while preserving inline editing, order controls, CSRF protection, and accessible empty/error states.
- [ ] 2.3 Move the existing derived answer matrix into the Results view, rename user-facing Actuals terminology, and keep review markers and Race Data links intact.
- [ ] 2.4 Make `/admin/actuals` and existing Questions URLs resolve to the corresponding workspace view without losing season, edit, or supported focus context; simplify admin navigation to one grouped entry.

## 3. Canonical season propagation

- [ ] 3.1 Pass the selected/current season question set through prediction forms, response validation, leaderboard scoring, derivation, and Results overview construction.
- [ ] 3.2 Ensure excluded questions are absent from new season forms and Results rows while historical responses, snapshots, published pointers, and stable IDs remain readable.
- [ ] 3.3 Add audit logging and actionable validation errors for season question-set mutations.

## 4. Verification

- [ ] 4.1 Add unit and integration tests for migration idempotence, per-season inclusion/order/points, stable IDs, and excluded-question propagation.
- [ ] 4.2 Add template/route tests for the shared toggle, season query state, terminology, read-only Results, and compatibility entry points.
- [ ] 4.3 Run the full project test suite and strict OpenSpec validation.
- [ ] 4.4 Rebuild the isolated preview without resetting its database, verify the Questions ↔ Results flow with Playwright/CUA, and confirm 2026 data plus a 2027 variant behave independently.
