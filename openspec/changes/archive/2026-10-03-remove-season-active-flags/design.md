## Context

The current schema stores four unrelated `active` columns on canonical drivers, canonical teams, season drivers, and season teams. The Inputs page exposes the season-level values while the lineup service also filters on them, even though round-bounded `driver_team_assignments` already describes who occupies which seat. This change is development-only; the preview database may be migrated forward and production will not be deployed.

## Goals / Non-Goals

**Goals:**

- Make season membership row-based and make seat assignments the only source of grid participation.
- Remove the ambiguous columns, request fields, UI controls, seed arguments, and dead translations.
- Preserve canonical identities, assignment history, aliases, provider references, actuals, and audit records.
- Keep roster removal safe by deleting only unreferenced season membership rows.
- Keep the existing season lifecycle `planned`/`active`/`archived` status; it is unrelated to driver/team activity.

**Non-Goals:**

- Adding a replacement `retired`, `reserve`, or `current` driver status.
- Rewriting assignment intervals or changing scoring/actual derivation.
- Deploying to production or copying production data into the preview.

## Decisions

### 1. Remove all four driver/team activity columns

Fresh SQLite and PostgreSQL schemas will not create `active` on `drivers`, `teams`, `season_drivers`, or `season_teams`. Startup schema normalization will remove those columns from an existing development/preview database. Before dropping season membership columns, rows marked inactive with no assignments are removed; rows with assignment history are retained so historical references remain visible.

Keeping the columns but ignoring them was rejected because it leaves a second, misleading source of truth. A new enum was rejected because the requested domain does not need career status or reserve status to calculate race results.

### 2. Use membership rows and assignment intervals

Repository helpers will no longer accept or return activity flags. A row in `season_drivers` or `season_teams` means that the identity belongs to the season. `driver_team_assignments` remains the authoritative relation for team, seat, and round. Projection and lineup application will load all season members and validate requested driver IDs against membership, without filtering by activity.

### 3. Make removal explicit and history-safe

The existing driver/team remove action will delete the season membership row only when no assignment references that entity in the selected season. If assignments exist, it will reject the request with a clear message and preserve every row. Canonical driver/team records are never deleted by this action. Assignment-period removal continues to operate on assignment rows.

### 4. Simplify the Inputs presentation

Drivers will show number, driver, and resolved team-at-round information. Teams will show order, team, and seat periods. Both Active columns and editor checkboxes disappear. The normal editor no longer submits `season_active`; the server ignores no compatibility field because the development model is intentionally forward-only.

### 5. Migrate all producers and tests together

Seed scripts, preview fixtures, route handlers, repository tests, lineup tests, and rendered-view assertions will be updated in the same change. The migration is verified on an isolated SQLite database and on the rebuilt PostgreSQL-backed preview before browser review.

## Risks / Trade-offs

- **Old inactive membership rows become ambiguous after the column is dropped** → delete only unreferenced inactive rows during startup normalization and retain referenced rows for historical integrity.
- **Removing an unreferenced roster row may surprise an admin** → keep the existing confirmation and return a clear success/error message; canonical identities remain available for re-adding.
- **A caller still submits `season_active`** → remove all first-party callers and add view/route tests that assert the field is absent; the server no longer uses the field.
- **A lineup projection receives a driver not in the season roster** → retain existing membership validation and reject the change before writes.

## Migration Plan

1. Commit this proposal and artifacts separately from implementation.
2. Remove activity fields from fresh schemas and add a one-time forward-only normalization in `ensureSeasonInputsSchema`.
3. Update repository, lineup, admin route, view, locale, seed, and test code.
4. Run syntax checks, focused model/route/view tests, the full Node 22 suite, and strict OpenSpec validation.
5. Rebuild the sanitized preview from the exact implementation commit; verify PostgreSQL health and inspect Drivers, Teams, temporary assignment gaps, and protected removal behavior.
6. Do not deploy production. Rollback, if needed before merge, is a Git revert plus preview rebuild; no production data migration is authorized here.
