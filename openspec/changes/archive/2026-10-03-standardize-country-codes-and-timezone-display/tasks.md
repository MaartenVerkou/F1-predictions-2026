## 1. Domain and seed data

- [x] 1.1 Change country normalization to strict three-letter F1-style codes for teams and races while preserving stable IDs and schedule values.
- [x] 1.2 Update 2026 team base-country and race country seed values, preserving country metadata when older seed paths omit it.

## 2. Admin presentation

- [x] 2.1 Remove the redundant race country token from the compact metadata line while keeping the field editable.
- [x] 2.2 Add date-specific UTC-offset formatting in parentheses and retain the IANA timezone as hover metadata.

## 3. Verification and preview

- [x] 3.1 Add normalization, seeded-value, locale/static-view, and timezone-offset tests.
- [x] 3.2 Run syntax checks, full tests, strict OpenSpec validation, rebuild and seed the isolated preview, verify teams/races in the UI, and confirm production health/data remain unchanged.
