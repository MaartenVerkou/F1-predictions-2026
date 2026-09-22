## 1. Schema and domain model

- [x] 1.1 Add nullable driver profile columns and idempotent SQLite/PostgreSQL schema migration checks.
- [x] 1.2 Add normalization/validation helpers, persist profile metadata through driver upserts, and derive season-aware age without storing it.
- [x] 1.3 Extend season input reads and seed support so profile metadata is available to the admin view while assignments remain separate.

## 2. Admin workflow and presentation

- [x] 2.1 Extend driver edit/add routes and forms with code, nationality, and date-of-birth validation while preserving season number handling.
- [x] 2.2 Replace the Drivers Team column with Code, Nationality, and Age columns and keep the table responsive/compact.
- [x] 2.3 Add localized labels, validation feedback, and empty-state rendering for missing metadata.

## 3. Verification and preview

- [x] 3.1 Add focused tests for schema migration, normalization, age calculation, route validation, and rendered table structure.
- [ ] 3.2 Run OpenSpec validation and the project test gates, then rebuild and smoke-test the isolated preview without changing production.
