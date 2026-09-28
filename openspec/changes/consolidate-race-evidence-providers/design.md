## Context

The active canonical-dataflow work already persists normalized evidence and the Race Data read model already knows how to render practice and sprint-qualifying keys. The current provider adapter does not populate those keys: it requests only Race, Qualifying, Starting Grid, and Sprint from Formula 1 Dashboard. The preview therefore has no practice or Sprint Qualifying facts even though the UI has columns for them.

The server can reach OpenF1 historical endpoints, while direct Formula 1 Dashboard requests are rejected. OpenF1 provides session metadata, session results, and starting grids; Jolpica/Ergast remains the stable structured source for championship standings; the existing Driver of the Day award and destructors importer remain separate because neither fact is supplied by the session provider.

## Goals / Non-Goals

**Goals:**

- Reduce overlapping sources to a small ownership matrix with one canonical provider per fact.
- Add a provider-neutral session collection that covers both normal and sprint weekends.
- Backfill completed rounds safely and make future imports idempotent.
- Preserve current evidence, participant answers, reviewed Actuals, and correction history.
- Make provider and session provenance visible enough to audit without adding noisy UI.

**Non-Goals:**

- Import telemetry, laps, weather, radio, or other high-volume OpenF1 datasets.
- Recompute historical timestamps or claim that a backfill was fetched on the original race date.
- Automatically replace conflicting reviewed race facts or publish newly derived Actuals.
- Remove the existing Driver of the Day or destructors questions.

## Decisions

### 1. Use a three-source ownership matrix

Use OpenF1 for Practice 1-3, Sprint Qualifying, Sprint, Grand Prix Qualifying, Starting Grid, and Race. Use Jolpica/Ergast for driver and constructor standings by round, with its existing Formula1.com Driver of the Day fetch retained only for that award. Use the approved Reddit destructors importer for crash-component costs. Formula 1 Dashboard remains available only as historical comparison context while migration is verified; it is not an import option for standard session results.

This is the smallest safe set for the current question set. Reducing to OpenF1 alone would make championship standings depend on beta endpoints and would not provide Driver of the Day or destructors costs. Keeping Jolpica for standard session results would duplicate the exact facts OpenF1 is being added to provide, so it is removed from that responsibility.

### 2. Store one generic session collection

Extend the normalized evidence payload with a canonical sessions map keyed by practice1, practice2, practice3, sprintQualifying, sprint, qualifying, startingGrid, and race. Each entry contains session identity and dates, availability state, source provenance, normalized rows, and an explicit unavailable/cancelled reason when applicable. Existing race, qualifying, and sprint readers are migrated to this collection, then removed once all snapshots and consumers use the canonical map.

Rows retain canonical driver/team IDs where unique, provider number/name/team, position, status, points where applicable, grid position where applicable, timing fields, and unresolved reasons. Qualifying and sprint qualifying are classified by both provider session type and session name.

### 3. Map provider meetings to the configured calendar

OpenF1 uses meeting and session keys rather than the application's round number. The importer matches a meeting to the selected season catalog using normalized name, circuit, and date, requires a unique match, and records the mapping. Testing meetings, cancelled meetings, and unmatched meetings are excluded from race rounds and reported instead of guessed.

### 4. Backfill by merge with revisioned evidence

The backfill first runs as a dry-run and reports expected sessions, row counts, unresolved identities, and differences against the current effective snapshot. Apply creates a reconstructed import and a new evidence revision only when normalized facts differ or missing sessions are added. Existing rows are preserved unless the administrator accepts a reported conflict; reviewed/published Actuals remain intact and affected questions receive a pending derived revision.

### 5. Future sync is session-completion driven

The future sync polls session metadata and imports only when a result or cancellation is available. The idempotency key combines season, meeting key, session key, provider schema, parser revision, and payload hash. Provider calls occur only in the import worker; rendering, derivation, and scoring read persisted evidence.

### 6. Keep a reversible migration boundary

During migration, the read model accepts both the canonical sessions map and the current top-level session fields, with canonical writes. A one-time preview migration rewrites existing snapshots into the map and runs parity comparisons. The old Formula 1 Dashboard standard-results adapter and the compatibility reader are removed only after the preview gate passes. Rollback uses the prior image and retained evidence revisions; no participant-answer data is deleted.

## Risks / Trade-offs

- **[Risk]** OpenF1 can be rate-limited or incomplete for a newly finished session. -> Use bounded retries, cache by session key, retain unavailable states, and retry without overwriting the last effective revision.
- **[Risk]** Provider driver names or replacement drivers do not resolve to the season catalog. -> Preserve provider labels and IDs, surface unresolved rows, and block only affected derivations.
- **[Risk]** OpenF1 and Jolpica disagree on a race or standings fact. -> Keep the provider ownership matrix, run a comparison report during backfill, and require explicit admin resolution before changing reviewed evidence.
- **[Risk]** The generic session map breaks existing pages. -> Migrate the shared read model first, run parity tests for every existing session consumer, and keep a temporary dual reader.
- **[Trade-off]** Three sources remain instead of one. -> Each source has a non-overlapping responsibility; removing one would either lose a current question's evidence or rely on an explicitly beta/unsupported substitute.

## Migration Plan

1. Add provider-policy and generic-session contract tests plus the OpenF1 adapter behind a dry-run command.
2. Add canonical session serialization and dual-read support; migrate Race Data and evidence derivation.
3. Run a 2026 completed-round dry-run and compare OpenF1 session facts with current persisted race/qualifying/sprint facts and Jolpica standings.
4. Apply the backfill to isolated preview only, recompute pending Actuals, and inspect conflicts/unresolved mappings.
5. Enable future session sync for preview; verify reruns, partial sessions, cancellations, and a replacement driver.
6. Remove the Formula 1 Dashboard standard-results selector and obsolete duplicate paths; retain only destructors comparison/import support as documented.
7. Run full tests, OpenSpec validation, health checks, and critical Playwright flows. Production remains unchanged until explicit approval.
