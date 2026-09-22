## 1. Domain status mapping

- [x] 1.1 Add a deterministic race status helper that applies explicit overrides before deriving upcoming, started, or unscheduled from the scheduled instant.
- [x] 1.2 Attach the derived status to the season-input race view model without changing stored race fields.

## 2. Admin presentation

- [x] 2.1 Render localized live status labels in the races table and explain that scheduled is automatic time derivation in the editor.
- [x] 2.2 Add locale strings and fallback-safe formatting for all derived and explicit status labels.

## 3. Verification

- [x] 3.1 Add focused deterministic tests for future, started, missing-start, and explicit override cases.
- [ ] 3.2 Run lint, unit tests, OpenSpec strict validation, and preview health/UI checks; confirm production remains unchanged.
