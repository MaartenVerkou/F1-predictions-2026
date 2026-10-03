## Context

The existing canonical tables already hold immutable driver/team identities, season membership, and round-bounded `driver_team_assignments` with seat numbers. The current admin page exposes those rows directly and only offers a create-like assignment form; it does not provide a safe way to end an assignment at the previous round, apply a replacement, or perform a swap. The existing `assignmentForRound` helper is not yet a downstream source of truth, so the UI and read paths can disagree.

## Goals / Non-Goals

**Goals:**

- Make the common admin operation a single team-centric lineup edit for one effective round.
- Preserve normalized, round-bounded assignment history and make replacements/swaps atomic.
- Introduce one shared round-resolution service used by lineup projection, Race data, Questions, and Actuals.
- Add an advanced canonical-driver creation path for mid-season replacements.
- Keep imported source evidence immutable and production deployment gated by preview approval.

**Non-Goals:**

- Allowing admins to edit imported race results from the lineup editor.
- Replacing canonical provider mapping or alias management.
- Automatically inferring a replacement from an external provider without admin confirmation.
- Rewriting existing historical assignment rows in place when a new effective round is selected.

## Decisions

### 1. Use a lineup command, not per-row assignment mutations

The UI submits the desired two-seat lineup for one season and effective round. The service reads the current projection, validates the complete desired state, computes a diff, and commits all interval changes in one transaction. This handles a swap without exposing a transient duplicate assignment. The existing low-level assignment endpoint becomes an advanced compatibility path or is removed from the primary navigation.

### 2. Split intervals automatically at the selected round

For a changed seat at round N, close the currently effective assignment at N-1 and insert a new assignment at N. If the current assignment already starts at N, update that interval's driver/team only after the full-lineup validation. Round 1 changes replace the initial assignment without creating an invalid round 0.

### 3. Keep seat identity separate from driver identity

The lineup projection uses seat 1 and seat 2 for the team, while drivers remain canonical entities. A driver may occupy only one active seat in the season projection, and each team seat has at most one driver for a round. Driver number, provider identity, and display order remain separate concerns.

### 4. Add canonical drivers through an advanced identity flow

The lineup editor only selects existing canonical drivers. A separate admin action creates a driver, season membership, and optional alias/provider reference, then returns to the lineup editor. This keeps the common edit compact and makes identity creation auditable.

### 5. Centralize effective-round resolution

Introduce a shared read service that returns the effective driver/team/seat projection for a season round. Race-data, Questions, Actuals, and the lineup page use it. Imported evidence continues to store the observed provider team and source labels; the service does not mutate evidence when a later lineup change occurs.

### 6. Keep advanced history available but secondary

The main Inputs view shows the lineup and one effective-round selector. Assignment history, IDs, order basis, aliases, and provider references move into collapsible or secondary views for diagnostics and exceptional corrections. The page must still expose clear validation errors and an audit event for each committed lineup change.

## Risks / Trade-offs

- **A multi-seat save could hide a partial error** → validate the complete desired lineup before opening the write transaction and return field-level errors without committing anything.
- **A historical round edit may surprise admins** → default the selector to the next editable round and show an explicit warning when the selected round has imported evidence or reviewed actuals.
- **Existing downstream paths still read labels** → route all touched round-specific lookups through the shared resolver and add regression tests for pre/post replacement rounds.
- **A new driver may be missing provider metadata** → allow the driver to exist with an unresolved mapping, but surface that state in the advanced identity view and never guess a provider identity.
- **Legacy low-level assignment callers may remain** → keep a compatibility wrapper that delegates to the same transaction service until all callers are migrated.

## Migration Plan

1. Add the shared effective-round projection and atomic lineup command around the existing assignment tables.
2. Add tests for replacement, swap, empty seats, duplicate occupancy, round cutoffs, permissions, and unchanged source evidence.
3. Replace the primary Inputs tabs with the lineup editor; retain history and identity tools as advanced views.
4. Update Race data, Questions, and Actuals to use the effective-round projection and verify canonical labels remain stable.
5. Add the advanced canonical-driver flow and seed preview fixtures with at least one replacement scenario.
6. Refresh the sanitized preview and run release checks; do not migrate or deploy production until explicit approval.

## Open Questions

- Whether an admin may edit a round with already reviewed actuals directly, or must create an explicit correction record first. The first implementation can warn and allow only an advanced confirmation if product policy permits it.
