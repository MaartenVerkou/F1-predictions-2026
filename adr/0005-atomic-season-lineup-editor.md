# ADR 0005: Edit season lineups as atomic round projections

Date: 2026-09-21

## Status

Proposed

## Context

The normalized assignment model correctly represents driver/team history, but exposing interval rows makes ordinary roster changes unnecessarily difficult. A mid-season replacement currently requires manual end-round and start-round edits, and a two-driver swap can fail if writes are applied one seat at a time. Several read paths also do not consistently consume the effective assignment for the selected round.

## Decision

Make the team-centric, round-selected lineup projection the primary admin editing boundary. An admin submits the desired two-seat lineup for one effective round. A single transaction validates the complete desired state, closes superseded assignments at the prior round, creates replacement intervals, and records one audit event. The normalized assignment history remains the source of truth; the projection is only the safe editing interface.

Use one shared effective-round resolver for Inputs, Race data, Questions, and Actuals. Imported race evidence remains immutable provenance and is never rewritten by a lineup edit. New canonical drivers are created through a separate advanced identity flow before they can be selected in the lineup.

## Consequences

- Driver replacement and seat swaps become one understandable operation.
- Historical assignments remain queryable and reproducible.
- All round-specific consumers share the same relationship logic.
- The implementation needs transaction-level validation and a compatibility path for existing low-level assignment callers.
- Editing a round with reviewed actuals needs an explicit product policy and warning.

## Alternatives Considered

- **Expose raw assignment rows**: rejected because it requires interval bookkeeping and cannot safely express swaps.
- **Store `driver_1` and `driver_2` directly on `season_teams`**: rejected because it loses history and cannot represent round-bounded replacements.
- **Infer lineup changes from imported provider results**: rejected because provider data is evidence, not an admin-approved canonical roster decision.
