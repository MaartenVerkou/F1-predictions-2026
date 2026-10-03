## Why

Race evidence is now the intended source of truth, but the Race Data admin page still mixes fact tables, question-specific projections, and derivation controls in one focus-driven surface. That makes it difficult to distinguish stored race facts from calculated views and makes corrections look like ordinary table edits. This change establishes one review workspace: facts first, reusable metric views second, and an explicitly protected derivation review area last.

## What Changes

- Make persisted, round-scoped race evidence the only input to question derivation and scoring.
- Add a stable Race Data workspace with only Season and Round as the global selectors.
- Show a primary race-result table first, always ordered by race finish position.
- Show driver and constructor championship tables below it, using shared table components and explicit metric modes such as points, DNFs, podiums, fastest laps, qualifying, and sprint results.
- Replace question-driven table switching in the primary workspace with reusable view controls; keep a separate question-linked derivation review section that selects the required view automatically.
- Add a protected admin correction flow for persisted race evidence. Corrections create a new evidence revision, require confirmation, record who/when/why, and never overwrite participant answers.
- Derive Actuals from the selected evidence revision and expose a compact race-by-question Actuals overview rather than duplicating another race matrix.
- Remove superseded focus-driven markup, route-level transformations, duplicate table models, and legacy correction paths after parity tests pass.

## Capabilities

### New Capabilities

- `race-data-canonical-review`: Canonical race-result evidence, reusable metric views, protected corrections, provenance, and revision-aware read models.
- `actuals-derivation-overview`: Question-by-race derived actuals overview and review/publish behavior sourced from canonical race evidence.

### Modified Capabilities

- `admin-race-result-review-workspace`: Replace the current focus-first layout with the stable fact/metric/derivation workspace and preserve responsive/accessibility behavior.
- `actuals-sync-review`: Derive reviewed actuals from persisted evidence revisions and make publication explicit without creating a second factual source.

## Impact

- Affects the Race Data and Actuals admin routes, shared table/read-model services, evidence persistence, derivation/scoring boundaries, correction audit records, templates, styles, tests, and localized labels.
- Requires additive provenance/correction metadata and a reversible migration before any legacy table or duplicate projection is removed.
- Does not change participant response tables, guest claims, authentication, or production data during preview implementation.
