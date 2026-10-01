# ADR 0007: Use Formula 1 Dashboard through a persisted evidence adapter

Date: 2026-09-26

## Status

Proposed

## Context

The race-data audit needs reliable constructor and race facts, including starting grids, qualifying, sprints, and standings evolution. Formula 1 Dashboard publishes a useful read-only API, but it is an unofficial external project whose responses can change, be incomplete, or use provider-specific IDs and sentinel values. Calling it from pages or scoring would make results non-reproducible and would make an outage indistinguishable from missing or zero data.

## Decision

Integrate Formula 1 Dashboard as a selectable, versioned evidence provider. A server-side adapter validates and normalizes its calendar, race, starting-grid, qualifying, sprint, driver-standings, and constructor-standings responses into the existing provider-neutral evidence contract. The importer stores provider identity, endpoint provenance, payload/parser revisions, source labels/IDs, and unresolved/conflict reasons in the immutable evidence bundle. Race data, Actuals, and scoring read only persisted evidence and reviewed/published snapshots.

The provider is enabled first for isolated preview and explicit admin sync configuration. Production retains its current provider until a separate comparison and deployment approval. No production database is copied into preview and no synthetic fallback is allowed when the provider fails.

## Consequences

- Constructor and grid facts can be imported through one auditable path and reused by Race data and Actuals.
- External API changes are isolated to one adapter and are visible as evidence revisions instead of silently changing scores.
- The application must maintain mapping aliases for provider IDs/labels and expose unresolved conflicts to admins.
- Imports are slower and add provider availability/rate-limit risk, so timeout, retry, idempotency, and preview verification are required.
- Production rollout remains gated by a sanitized preview comparison; the provider is not a runtime dependency for participants.

## Alternatives Considered

- **Call the API from Race data/Actuals pages:** rejected because pages would be non-reproducible and provider outages could alter answers.
- **Replace the existing provider immediately:** rejected because an unofficial source needs parity and conflict review first.
- **Copy the provider response into a new provider-specific table:** rejected because it duplicates the evidence model and makes scoring depend on storage shape rather than a stable contract.
