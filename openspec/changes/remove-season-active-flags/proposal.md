## Why

The driver and team `active` flags mix three different concepts: season membership, current race-seat occupancy, and long-term career status. This makes the Inputs tables misleading, especially when a driver is temporarily sidelined or replaced. The normalized round-bounded seat assignments already provide the correct source of truth, so the unused status model should be removed while the app is still in development.

## What Changes

- **BREAKING** Remove `active` columns from canonical `drivers` and `teams` records and from `season_drivers` and `season_teams` membership records.
- **BREAKING** Remove `season_active` fields, Active columns, and Active checkboxes from the Inputs Drivers and Teams workflows.
- Derive race participation exclusively from `driver_team_assignments` intervals; no assignment for a round means the driver is not occupying a race seat for that round.
- Treat the presence of a row in `season_drivers` or `season_teams` as season membership.
- Keep canonical driver/team identities and historical seat assignments intact; do not introduce a replacement retired/current-status flag.
- Replace active-based lineup filtering with membership and assignment validation.
- Replace active-based entity removal with explicit membership removal rules that protect referenced historical assignments.
- Remove seed, preview-fixture, schema, route, view, and test code that reads or writes the obsolete flags.

## Capabilities

### New Capabilities

- `season-roster-membership`: Defines season membership separately from round-specific seat occupancy.

### Modified Capabilities

- `admin-interface`: Drivers and Teams no longer expose an ambiguous Active state; membership is represented by the season catalog and seat periods by assignments.

## Impact

- Affected schema creation and startup migration for SQLite and PostgreSQL.
- Affected season input repository helpers, lineup projection/application, admin mutation routes, seed scripts, and Inputs templates.
- Existing preview databases will have the obsolete columns removed on startup; production is not deployed or modified in this change.
- Historical assignments, canonical IDs, aliases, provider references, race data, actuals, and audit records remain unchanged.
- Focused model, route, rendering, seed, and schema tests must be updated and the full Node 22 test suite rerun.
