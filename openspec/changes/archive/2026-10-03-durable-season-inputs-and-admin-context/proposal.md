## Why

The current season model has the right canonical tables, but the admin experience still treats 2026 as a hard-coded current season and exposes driver/team history through technical tables. That makes past-season audits, future-season preparation, and downstream reuse of team/driver data harder than necessary, and it risks different pages reading different season contexts.

## What Changes

- Add a durable season context shared by season-scoped admin pages, with explicit planned, active, and archived states.
- Replace the numeric `2026` plus `Open` interaction with a season selector that carries the selected season through tabs, round selectors, and links.
- Make Inputs, Race data, Actuals, and other season-scoped views read the selected season instead of silently using `CURRENT_SEASON`.
- Keep Questions explicitly global until question configuration becomes season-specific, rather than adding a misleading season selector.
- Treat canonical drivers, teams, season membership, and round-bounded team-seat assignments as the durable source of truth for future and historical seasons.
- Keep the team-centric round-aware lineup as the primary edit surface; demote raw assignment intervals to a read-only line-up history view.
- Unify admin tables around reusable compact table, toolbar, row-selection, inline-editor, add, deactivate, and empty-state patterns.
- Remove low-value technical columns such as assignment `source`, race `slug`, and raw database IDs from primary tables while retaining provenance and identifiers internally.
- Replace raw mapping forms with an understandable unresolved provider-mapping queue and explicit resolve actions.
- Add safe read-only behavior for archived seasons and explicit preparation/edit flows for planned seasons.

## Capabilities

### New Capabilities

- `durable-season-inputs`: Defines the season lifecycle, canonical driver/team model, season memberships, round-bounded seats, and historical/future-season behavior.

### Modified Capabilities

- `admin-interface`: Add shared season context and reusable table interaction rules across admin workspaces.
- `admin-race-result-review-workspace`: Make race-data review use the selected season and effective round context.
- `actuals-sync-review`: Make actual snapshots and review actions season-aware while restricting live sync to the active season.

## Impact

- Update admin route context resolution, navigation links, Inputs/Race data/Actuals view models, and localized UI components.
- Add shared table partials/styles/interaction contracts and simplify Inputs columns/forms.
- Extend targeted tests for season switching, archived/planned states, round cutoffs, canonical renames, team changes, mapping resolution, and cross-page consistency.
- Use the existing SQLite/PostgreSQL canonical tables and season status field; no production data copy or destructive migration is required.
- Preview receives sanitized fixtures for at least one active, one planned, and one archived season; production remains unchanged until explicit approval.
