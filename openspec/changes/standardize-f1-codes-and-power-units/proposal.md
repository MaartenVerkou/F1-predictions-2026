## Why

The input model currently mixes ISO-style two-letter nationality/base-country values with the three-letter codes used in Formula 1 presentation and result data. Team records also lack their power-unit supplier, which is a meaningful canonical input for questions and race analysis.

## What Changes

- Standardize driver nationality values to three-letter uppercase F1-style codes (for example `GBR`, `ITA`, `NED`) and update the 2026 seed data.
- Require every team code to be a three-letter uppercase identifier and normalize the existing team catalog accordingly.
- Add optional team power-unit metadata, seed the 2026 suppliers, and expose it in the team table and editor.
- Keep stable IDs, assignment intervals, base-country values, and production data unchanged.

## Capabilities

### New Capabilities

- `f1-codes-and-power-units`: Canonical F1 presentation codes and team power-unit metadata for reusable season input data.

### Modified Capabilities

## Impact

- Additive SQLite/PostgreSQL team schema and migration, plus the existing driver nationality validation.
- 2026 roster seed data, admin inputs team/driver forms, localized labels, and compact team table presentation.
- Focused tests and preview seed/rebuild only; no production database or deployment changes.
