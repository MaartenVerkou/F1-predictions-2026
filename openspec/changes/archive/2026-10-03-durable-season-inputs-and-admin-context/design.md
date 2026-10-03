## Context

The canonical tables and round-bounded assignment service already exist from the earlier season-inputs work, but page routing and presentation still treat 2026 as the implicit season. Inputs also mixes primary lineup editing with low-level history and provider mapping forms. The design must preserve the existing SQLite/PostgreSQL schema contract, keep production data isolated, and allow future seasons to reuse canonical entities without reusing positional IDs.

## Goals / Non-Goals

**Goals:**

- Make season selection an explicit, reusable context for every season-scoped admin workspace.
- Make canonical driver/team identity, season membership, display order, and round-bounded seats distinct and reusable by imports, race data, questions, actuals, and future integrations.
- Make the common admin workflow compact while retaining a trustworthy historical audit path.
- Give planned and archived seasons safe, predictable behavior.
- Establish one table interaction contract without forcing every resource to expose the same actions.

**Non-Goals:**

- Making question definitions or point settings season-specific in this change.
- Replacing imported evidence with mutable lineup data.
- Copying production data into previews or silently migrating ambiguous provider rows.
- Making database IDs meaningful to users or using IDs as season ordering.

## Decisions

### 1. Use a season context object at route boundaries

Every season-scoped route resolves a context from the `seasons` table and the `season` query/form value. The context contains the season ID/year/label/status, whether it is editable, whether live sync is allowed, and lightweight counts for the selector. If no season is supplied, the active season is the default; an invalid or unavailable season is an explicit error/empty state rather than a fallback.

The context is serialized into every season-scoped tab, round selector, redirect, and mutation form. Questions remain global and receive an explicit global-settings label instead of a fake season context.

Alternative rejected: keep a process-level `CURRENT_SEASON` and add ad-hoc query parameters page by page. That is the source of the current inconsistency.

### 2. Keep typed canonical tables and add validation around intervals

The existing typed model remains the source of truth:

```text
seasons
  ├── season_drivers ── drivers
  ├── season_teams   ── teams
  ├── races
  └── driver_team_assignments
          ├── driver_id
          ├── team_id
          ├── seat_number
          ├── from_round / to_round
          └── source (provenance only)
```

Canonical driver/team IDs are immutable. Season membership owns driver numbers, active state, and optional display overrides. `season_teams.display_order` owns presentation order. `driver_team_assignments` owns historical seat occupancy and is validated for non-overlapping driver intervals, non-overlapping team-seat intervals, and one driver in at most one active seat per round.

Alternative rejected: one generic entities table or encoding a team in a driver's current row. Typed foreign keys and interval validation are safer for downstream consumers.

### 3. Make the lineup projection the primary write model

The shared effective-round resolver produces a team-centric projection for a season and round. Teams page edits submit the complete desired two-seat projection through one transaction; the service closes prior intervals and inserts new intervals at the selected round. Race data, Questions, Actuals, and future APIs consume the same projection for display, but observed team IDs in imported evidence remain immutable provenance.

The assignment table remains available as a read-only history view. A low-level assignment mutation can remain as a compatibility endpoint, but it is not the primary admin workflow.

### 4. Build a shared admin table shell with resource capabilities

Create shared view/CSS/JavaScript contracts for table shells, table toolbars, selectable rows, inline editor rows, order controls, empty states, and confirmation messages. Each resource declares capabilities such as `add`, `edit`, `deactivate`, `reorder`, or `resolve`; the shell renders only applicable actions.

This keeps Drivers, Teams, Races, and Mapping queue consistent without forcing derived Assignment history to look editable. The primary tables omit IDs, slugs, and assignment source; advanced diagnostics and audit events retain those values.

### 5. Turn mappings into a resolver queue

Aliases and provider references remain normalized in `entity_aliases` and `entity_provider_refs`. A mapping read model joins unresolved source/provider rows to candidate canonical entities and exposes one explicit resolve action. The main view uses provider, source label/key, entity type, candidate, and status; raw numeric entity IDs are hidden. When there is no unresolved work, the page explains that imports are currently fully mapped instead of showing empty CRUD forms.

### 6. Enforce lifecycle safety at mutation boundaries

Planned seasons can be prepared but cannot receive live sync data. Archived seasons are viewable and read-only by default; historical corrections require an explicit confirmation flag and are audit logged. Only the active season may be targeted by automatic live sync. Preview fixtures contain sanitized planned, active, and archived examples without reading production data.

### 7. Keep migration additive and reversible

The first implementation reuses existing tables and columns, adds route/view models and validations, and backfills only preview fixtures and test data. Any new indexes or constraints are additive. Production deployment remains gated until the selected-season flows and historical interval tests pass in preview.

## Risks / Trade-offs

- **A page forgets to propagate the context** → centralize context resolution and test every season-scoped route's links and redirects.
- **Archived data is accidentally edited** → enforce lifecycle checks server-side, not only by disabling buttons.
- **Driver/team intervals overlap during a swap** → validate the complete projection before a single transaction and test boundary rounds.
- **The table shell becomes an over-generalized component** → share the interaction contract and toolbar, but keep resource-specific row markup in small partials.
- **Provider mappings are ambiguous** → keep source labels unresolved and visible; never auto-select among multiple candidates.
- **Historical lineup differs from observed race evidence** → evidence keeps its observed IDs and source labels; the resolver is only used for context and future projections.

## Migration Plan

1. Add the season-context resolver and shared URL/redirect helpers without changing data.
2. Add route coverage for Inputs, Race data, and Actuals using selected seasons; keep Questions explicitly global.
3. Extract shared admin table/toolbar interaction contracts and migrate Drivers, Teams, Races, and Assignments history.
4. Replace mapping CRUD forms with the unresolved mapping read model and resolve action.
5. Add interval/lifecycle tests, sanitize preview fixtures for planned/active/archived seasons, and run preview smoke tests.
6. After explicit preview approval, deploy the immutable image; do not run a production migration or live sync for historical/planned seasons.

## Open Questions

- Whether an archived-season correction should require a separate correction record in addition to the existing audit event. The first implementation can use the existing explicit confirmation and audit log without changing the canonical tables.
