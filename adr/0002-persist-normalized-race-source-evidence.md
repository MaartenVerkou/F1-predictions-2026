# ADR 0002: Persist normalized race source evidence

Date: 2026-09-21

## Status

Proposed

## Context

The season sync fetches race classification, qualifying, sprint, and standings data and then derives the actual values used by scoring. The current snapshot tables retain the derived values and review metadata, but not the source rows that explain those values. Re-fetching providers when an admin opens an audit page would be non-deterministic and could show different data from the sync that produced the snapshot.

## Decision

Persist one normalized source-evidence bundle per season round and sync in a dedicated `race_data_snapshots` table. Store only stable fields required for audit and actual derivation, together with source labels/URLs, fetch time, parser version, and per-source coverage state. Link each derived `actual_snapshots` row to the bundle used for its values.

Use JSON text for the normalized bundle so the same implementation works with the SQLite preview/test database and PostgreSQL production. Keep the audit page read-only; only the existing sync pipeline may create or update evidence.

## Consequences

- Admins can inspect the exact evidence associated with derived actuals without calling external providers again.
- Missing feeds remain distinguishable from zero results.
- Existing actual and review data can remain intact while evidence is added additively.
- The application must maintain a stable normalized payload contract and migration support for both database backends.
- Historical snapshots created before this decision may show an explicit “evidence not captured” state until a later sync populates evidence.
- Source bundles add storage and sync work, but avoid a larger set of provider-specific tables.

## Alternatives Considered

- Re-fetch providers on every page view: less storage, but results can change, providers can be unavailable, and the audit would not prove what the sync used.
- Embed the evidence JSON directly in `actual_snapshots`: fewer tables, but it couples source provenance to derived values and makes repeated sync evidence harder to retain.
- Persist raw provider HTML: maximum fidelity, but large, brittle, and unnecessary for the fields used by the actual calculations.
