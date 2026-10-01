## Why

Race evidence currently has several overlapping providers. Jolpica/Ergast supplies the existing race facts, Formula 1 Dashboard has a parallel adapter that is blocked from the server and only covers some sessions, and the new practice/sprint-qualifying backfill would introduce another path. This makes provenance, corrections, and future synchronization harder to reason about. We need one canonical session-results provider and a narrowly scoped source only for data that provider cannot supply.

## What Changes

- Make OpenF1 the canonical provider for official session results and starting grids: Practice 1-3, Sprint Qualifying, Sprint, Grand Prix Qualifying, Race, and grid metadata.
- Backfill completed rounds idempotently from OpenF1, preserving existing evidence and recording reconstructed provenance, provider/session keys, coverage, and conflicts.
- Add a future-session sync path that imports completed sessions without live API calls during rendering, derivation, or scoring.
- Keep the destructors source separate because crash-component costs are not provided by OpenF1; Formula 1 Dashboard is not used as a general race-results provider.
- Retire the generic Formula 1 Dashboard race-results provider selection and its duplicate race/qualifying/sprint import path after parity checks. **BREAKING**: F1_DATA_PROVIDER=formula1_dashboard is no longer a supported standard-results mode.
- Keep existing participant answers, reviewed actual revisions, and evidence corrections auditable; new imports create revisions and do not silently overwrite reviewed data.

## Capabilities

### New Capabilities

- `race-session-evidence`: Store, normalize, display, backfill, and future-sync all supported race-weekend sessions through one provider-neutral evidence contract.
- `evidence-provider-policy`: Define the canonical provider per fact type, provenance requirements, conflict handling, and the intentionally separate destructors source.

### Modified Capabilities

- None. This change supersedes the provider-selection portion of the in-progress canonical dataflow work without changing the participant-answer contract.

## Impact

- Provider adapters, evidence payload/schema, import and backfill scripts, season-calendar mapping, Race Data read models, actual derivation/review linkage, tests, and preview operations.
- OpenF1 is an unofficial external source and must remain an import-time dependency only. Production stays unchanged until preview comparison and explicit release approval pass.
