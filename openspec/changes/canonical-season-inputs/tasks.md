## 1. Canonical schema and resolver

- [x] 1.1 Add additive SQLite/PostgreSQL schema for seasons, drivers, teams, races, season memberships, round-bounded driver/team assignments, aliases, and provider references.
- [x] 1.2 Add shared canonical-input repository/resolver helpers with stable IDs, alias/provider lookup, overlap validation, and unresolved mapping results.
- [x] 1.3 Add ADR documenting canonical season inputs and ID-based identity semantics.
- [x] 1.4 Bootstrap the 2026 catalog from the current roster/calendar and produce deterministic provider mappings without changing production data.

## 2. Canonicalize questions, answers, actuals, and evidence

- [ ] 2.1 Extend question option resolution to return canonical entity options while preserving static scalar options and the existing JSON catalog contract.
- [ ] 2.2 Add dual-read/canonical-write serialization for responses, guest responses, actuals, and composite answers; preserve legacy label compatibility.
- [ ] 2.3 Update normalized race evidence and import derivation to persist driver/team/race IDs plus source labels and assignment metadata.
- [ ] 2.4 Add a migration/report command for resolvable and unresolved legacy answer/actual/evidence values; never silently rewrite ambiguous values.

## 3. Admin Inputs workspace

- [ ] 3.1 Add admin-only `/admin/inputs` route with season selector and Drivers, Teams, Assignments, Races, and Mappings tabs.
- [ ] 3.2 Add protected mutations for labels, aliases, provider references, calendar state, and round-bounded assignments with validation and audit logging.
- [ ] 3.3 Place Inputs before Questions in navigation and add localized labels/responsive styles.
- [ ] 3.4 Show affected source/snapshot counts and unresolved mappings before potentially impactful assignment or identity changes.

## 4. Downstream consistency and preview

- [ ] 4.1 Update Race data, Actuals, question forms, leaderboards, analysis, and scoring views to resolve labels from canonical IDs.
- [ ] 4.2 Replace index-based preview driver/team generation with a coherent sanitized catalog and assignment fixture.
- [ ] 4.3 Add tests for renames, team changes, provider aliases, ambiguous mappings, legacy values, and round cutoff consistency.
- [ ] 4.4 Refresh the sanitized preview and verify Inputs → Questions → Race data → Actuals end-to-end without changing production.

## 5. Release gates

- [ ] 5.1 Run OpenSpec strict validation, syntax/assets checks, targeted tests, full checks where supported, and preview smoke checks.
- [ ] 5.2 Keep the production migration and deployment pending explicit preview approval.
