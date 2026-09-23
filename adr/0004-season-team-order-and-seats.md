# ADR 0004: Season team order and driver seat occupancy

Date: 2026-09-21

## Status

Proposed

## Context

The canonical model correctly gives drivers and teams immutable IDs, but a database ID is not a useful presentation order. The admin needs a clear F1-style view where teams are grouped in a deliberate season order and each team shows two driver seats. Teams can be renamed, new teams can enter, and drivers can be replaced during a season. Storing `driver_1` and `driver_2` directly on a team row would duplicate history and cannot represent replacements safely.

## Decision

Keep entity IDs opaque and immutable. Store season-specific team ordering on `season_teams` as `display_order` plus `order_basis`; this order is independent from live championship position and may be changed per season without renumbering teams. Store `seat_number` (1 or 2) on round-bounded `driver_team_assignments`. A seat assignment is valid for its effective round range, and the data layer rejects overlapping occupancy for the same team seat as well as overlapping assignments for one driver. The admin UI renders a normalized team-centric lineup projection, while race evidence remains the historical record of the observed driver/team pairing.

## Consequences

- Team lists remain readable and stable even when database IDs are sparse or teams are added later.
- Driver changes and substitutes remain historical and round-aware.
- The UI can match the familiar F1 team-card layout without duplicating driver fields in the team table.
- A separate current-standings sort can be added later without changing the season's canonical lineup order.
- Existing assignments require a safe seat backfill; the 2026 fixture explicitly seeds the two seats for each team.

## Alternatives Considered

- Use IDs 1–11 as team order: rejected because IDs encode insertion history and cannot represent a future season order.
- Store `driver_1` and `driver_2` columns on season teams: rejected because swaps and substitutes create duplicated, conflicting historical state.
- Sort alphabetically: acceptable as a fallback, but less useful than an explicit official/season order and not representative of the reference F1 view.
- Sort continuously by live championship standings: rejected as the default because it reorders admin inputs during the season; it can remain an optional view.
