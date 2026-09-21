## Context

The current application loads `data/roster.json` and `data/races.json` as separate string arrays. Questions use `options_source`, responses store serialized labels, and race evidence normalizes provider rows to labels. Existing actual snapshots can therefore contain labels without a stable identity or historical team assignment. The implementation must work with SQLite previews/tests and PostgreSQL production, preserve existing scoring and review history, and avoid copying production data into previews.

## Goals / Non-Goals

**Goals:**

- Establish one canonical identity layer used by Inputs, Questions, Race data, Actuals, and scoring.
- Keep IDs immutable while allowing safe display-name changes and historical aliases.
- Represent season-specific driver/team membership and round-bounded assignments.
- Make imported evidence and derived values reproducible and identity-safe.
- Provide an admin workspace that exposes and validates the canonical inputs before question editing.
- Migrate legacy labels additively with an explicit unresolved mapping queue.

**Non-Goals:**

- Replacing the question authoring format or changing scoring rules.
- Reconstructing unknown historical identity mappings silently.
- Making provider APIs the authoritative source for canonical labels.
- Creating a public-facing roster management page.

## Decisions

### 1. Use typed canonical tables, not one generic entity table

Add `seasons`, `drivers`, `teams`, `races`, `season_drivers`, `season_teams`, and `driver_team_assignments`. Drivers, teams, and races have different lifecycle and relationship rules; typed tables keep foreign keys and validation explicit. IDs are database-generated immutable identifiers. Each table stores a stable slug and current display fields.

`driver_team_assignments` contains `season_id`, `driver_id`, `team_id`, `from_round`, and nullable `to_round`, with a non-overlap invariant per driver and season. A race result stores the team recorded for that result, so historical evidence is not rewritten when a later assignment changes.

### 2. Centralize external identity resolution

Add `entity_aliases` and `entity_provider_refs`, keyed by entity type and entity ID. Provider keys (for example Jolpica driver IDs and constructor IDs) are preferred; normalized aliases are the fallback. Import code, admin result parsing, and migration code call one resolver rather than carrying separate alias constants.

### 3. Keep source labels as provenance, IDs as semantics

Normalized evidence JSON gains `driverId`, `teamId`, and `raceId` alongside `driverLabel`, `teamLabel`, and provider metadata. Labels show what the source said; IDs determine joins, standings, question answers, actuals, and scoring. An unresolved provider row remains visible as unresolved and cannot be treated as a known zero.

### 4. Introduce Inputs as the upstream admin boundary

Add `/admin/inputs` before `/admin/questions` with a season selector and tabs for Drivers, Teams, Assignments, Races, and Mappings. Label and alias edits are safe mutations protected by the existing form-action protection. IDs cannot be edited. Assignment edits require an effective round and show affected evidence/snapshot counts before save where available.

### 5. Canonicalize answer values at the storage boundary

New response and actual serializers write canonical references: a single entity is stored as an entity reference, collections contain references, and composite driver answers contain a driver reference plus their scalar fields. Readers accept both canonical values and legacy labels. A migration rewrites resolvable legacy values; unresolved values retain the legacy value and appear in the Inputs mapping queue.

### 6. Keep compatibility with the existing JSON question catalog

`options_source` remains accepted for compatibility, but its resolver returns canonical option objects (`id`, `kind`, `label`) from the Inputs catalog. Static scalar options such as “More” and “Less” remain question-owned. This avoids a disruptive question-file rewrite while removing name-based identity from new writes.

### 7. Preview fixture uses coherent sanitized identities

The preview seed creates deterministic canonical inputs and a valid season assignment map, then generates race evidence from that map. It may use fictionalized labels, but the same driver always resolves to the same ID and the team shown in each round is the assignment used by the result. It never reads production data.

## Risks / Trade-offs

- **Legacy answers contain ambiguous labels** → resolve through provider refs and aliases, report unresolved values, and do not auto-rewrite ambiguous matches.
- **A team rename changes historical display text** → preserve source labels and optional label-at-capture fields; semantic joins continue using IDs.
- **A driver changes teams mid-season** → use round-bounded assignments and result-level team IDs; never infer historical team from the current roster.
- **Migration touches scoring boundaries** → dual-read legacy values first, add canonical-write tests, and block production activation until unresolved mappings are reviewed.
- **More admin concepts increase UI density** → keep Inputs as one top-level page with focused tabs and a compact unresolved-mapping summary.
- **Provider identity gaps** → retain source labels and mark rows incomplete rather than assigning a guessed entity.

## Migration Plan

1. Add tables, indexes, additive columns, and resolver helpers without changing scoring.
2. Bootstrap canonical 2026 inputs from the current roster/calendar and explicit provider references; produce a mapping report.
3. Add dual-read canonicalization and migrate resolvable responses, guest responses, actual values, and normalized evidence.
4. Add Inputs UI and correction workflow for unresolved or conflicting mappings.
5. Switch imports, question options, actual derivation, and scoring to canonical IDs; preserve legacy display values for audit.
6. Re-seed the sanitized preview and run targeted/full checks plus preview smoke tests.
7. Only after preview approval apply the production migration and activate the canonical model; retain rollback migrations for the additive phase.

## Open Questions

- Whether the long-term team identity should follow the sporting constructor or the legal entry when a constructor rebrands. The first implementation will preserve one canonical entry per configured 2026 team and model later changes as aliases unless an admin explicitly creates a new entity.
