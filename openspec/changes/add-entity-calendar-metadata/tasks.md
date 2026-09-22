## 1. Data model and normalization

- [ ] 1.1 Add additive team and race metadata columns to SQLite and PostgreSQL schema setup with constrained normalizers.
- [ ] 1.2 Extend upsert and seed paths with 2026 team and race metadata while preserving existing values when a season source is incomplete.

## 2. Admin workflow

- [ ] 2.1 Add localized metadata fields to team and race editors and persist them through the existing mutation route.
- [ ] 2.2 Show compact team and race metadata beneath names without widening the tables excessively.

## 3. Verification

- [ ] 3.1 Add tests for normalization, persistence, and seeded metadata.
- [ ] 3.2 Run syntax checks, full tests, OpenSpec validation, preview seed/UI checks, and production health checks without changing production data.
