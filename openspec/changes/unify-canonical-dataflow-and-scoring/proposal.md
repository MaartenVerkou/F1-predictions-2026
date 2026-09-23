## Why

Inputs now contain the canonical teams, drivers, races, memberships, and seat periods, but downstream pages still derive parts of their meaning independently. Actuals derivation is duplicated, scoring has more than one implementation, and the published actuals table is not season-scoped. That makes a rename, mid-season lineup change, provider correction, or second season difficult to reproduce safely.

This change makes Inputs the upstream contract and gives every later stage a single, versioned path from observed race evidence to reviewed actuals and scored answers.

## What Changes

- Treat the canonical season catalog as the only semantic source for drivers, teams, races, assignments, aliases, provider references, and season-specific metadata.
- Add a readiness/read-model contract so Questions, Race data, Actuals, and scoring consume the same resolved catalog and report unresolved mappings instead of guessing.
- Persist normalized race evidence before derivation, with canonical entity references, cutoff context, provenance, and an idempotent import identity.
- Replace route/script-specific actuals logic with one season-aware derivation engine that reads Inputs and persisted evidence.
- Make actual snapshots and the published actual set season-scoped, versioned, reviewable, and traceable to the catalog and evidence revisions.
- Make scoring use one shared canonical-value service and the season's reviewed/published actual set.
- Preserve existing preview data and legacy answer compatibility through explicit migration boundaries; do not copy production data into previews.

## Capabilities

### New Capabilities

- `canonical-dataflow`: Defines the resolved season catalog, readiness checks, revisions, and ownership boundaries used by all downstream stages.
- `race-evidence-derivation`: Defines normalized evidence imports, cutoff-aware derivation, provenance, idempotency, and unresolved-data handling.

### Modified Capabilities

- `actuals-sync-review`: Actual snapshots become season-scoped, revision-linked, and publishable only after review.
- `admin-race-result-review-workspace`: Race data and Actuals expose the same evidence/derivation state and selected-round cutoff.
- `leaderboard-insights`: Scoring consumes canonical references and the season's published actual set through one shared service.

## Impact

- Database schema and migrations for catalog revisions, evidence/import identity, season-scoped published actuals, and snapshot provenance.
- Shared services used by `src/season-inputs.js`, `src/race-data-evidence.js`, `src/actuals-snapshots.js`, `src/leaderboard-model.js`, sync/backfill scripts, and admin routes.
- Admin Inputs, Questions, Race data, Actuals, leaderboard, analysis, and scoring read models and their tests.
- Preview fixtures and end-to-end checks; production deployment remains gated on explicit preview approval.

