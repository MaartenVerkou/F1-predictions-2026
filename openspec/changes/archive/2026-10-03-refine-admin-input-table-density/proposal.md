## Why

The admin input tables expose useful team metadata, but labels such as `F1 2010` and `PU Mercedes` make the compact row harder to scan and leave too little room at narrow widths. The same tables should remain readable and operable on small screens without making the whole admin page overflow.

## What Changes

- Replace the technical `F1 {year}` label with a plain, readable `since {year}` label in team metadata.
- Present power-unit metadata as an optional compact label that remains understandable when present and does not dominate the team name.
- Apply one responsive table pattern to drivers, teams, races, and mapping tables: bounded horizontal scrolling for genuinely wide data, wrapping/truncation for secondary text, and no document-level overflow.
- Keep table actions, row selection, editors, and existing data fields unchanged.

## Capabilities

### New Capabilities

### Modified Capabilities

- `admin-interface`: compact team metadata and consistent responsive behavior for admin input tables.

## Impact

- Updates localized admin labels, admin input table markup/classes, and shared admin CSS.
- Adds focused view/style regression tests.
- No database schema, API, seed data, production deployment, or mutation workflow changes.
