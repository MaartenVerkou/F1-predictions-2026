## 1. Domain and seed data

- [x] 1.1 Change nationality validation to canonical three-letter F1 codes and add strict three-letter team-code validation without changing stable IDs.
- [x] 1.2 Add nullable team power-unit schema columns and preserve values through SQLite/PostgreSQL migrations and upserts.
- [x] 1.3 Update 2026 driver nationality/team-code seed values and add the official 2026 power-unit assignments.

## 2. Admin workflow

- [x] 2.1 Pass power-unit values through the team mutation route and add localized editor labels/validation for power units and three-letter nationality codes.
- [x] 2.2 Show team power unit in the compact team metadata line and keep team-code/nationality inputs aligned with the three-letter rule.

## 3. Verification and preview

- [x] 3.1 Add normalization, migration, persistence, locale, and seeded power-unit tests.
- [ ] 3.2 Run syntax checks, full tests, strict OpenSpec validation, rebuild and seed the isolated preview, verify teams/drivers in the UI, and confirm production health/data remain unchanged.
