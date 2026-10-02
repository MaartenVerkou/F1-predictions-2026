## Why

The Destructors Championship is published by an independent Reddit author after each race, but the current Formula 1 Dashboard API cannot be reached from our server. We need a repeatable server-side import that discovers the public update, preserves the original evidence, and lets an admin review it before it can affect actuals or scoring.

## What Changes

- Add an idempotent Reddit RSS discovery/import path for Destructors Championship posts from the configured author and season.
- Persist the raw post metadata and source content as immutable evidence, with the source URL, post identity, fetch time, parser version, and coverage state.
- Parse the public damage list when it is machine-readable and retain unresolved rows/components instead of turning missing values into zero.
- Create a pending race-data snapshot for a newly detected round; never publish or overwrite reviewed actuals automatically.
- Add retry, rate-limit/backoff, duplicate detection, and a missing-post status suitable for a scheduled worker.
- Add an explicit Formula 1 Dashboard API mirror fallback for deployments whose egress address is blocked by Reddit, while retaining source attribution and the same pending-review gate.
- Keep a manual/admin review path and make every imported revision reversible by selecting the prior reviewed snapshot.

## Capabilities

### New Capabilities

- `destructors-import`: Discover, persist, normalize, and review community-published Destructors Championship evidence.

### Modified Capabilities

<!-- No existing requirement changes; the importer uses the existing pending-review lifecycle. -->

## Impact

- New Reddit RSS provider/parser and scheduled import command.
- Existing race evidence payloads, provider provenance, and actual snapshot review lifecycle.
- PostgreSQL/SQLite schema migration for source-post metadata and import diagnostics.
- Admin review data/status and tests; no production provider switch or destructive migration.
