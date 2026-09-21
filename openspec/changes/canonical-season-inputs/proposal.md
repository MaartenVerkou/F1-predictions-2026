## Why

The application currently treats drivers, teams, races, question options, imported results, answers, and actuals as display-name strings. That makes source rows easy to misassociate, makes team or driver renames unsafe, and prevents the Race data audit from proving that a driver belonged to the displayed team for a given round. The preview exposed this gap because its fixture has no authoritative driver-to-team relationship.

## What Changes

- Add a canonical season-inputs capability with stable IDs for drivers, teams, races, and season membership.
- Add time-bounded driver/team assignments so mid-season changes remain historically correct.
- Add provider identity and alias mappings as explicit data, replacing scattered name-alias constants.
- Add an admin Inputs workspace before Questions for editing labels, assignments, calendar state, and unresolved mappings.
- Make question options resolve from canonical inputs and make new answers/actuals use canonical entity references.
- Store canonical driver/team/race references in normalized race evidence while retaining source labels for audit provenance.
- Migrate legacy name-based answers and actual values through aliases, leaving unresolved values visible for admin review.
- Correct the sanitized preview fixture to use coherent IDs and assignments instead of index-based team pairing.
- Update Race data, Questions, Actuals, and scoring to display current labels while comparing stable IDs.

## Capabilities

### New Capabilities

- `canonical-season-inputs`: Canonical drivers, teams, races, season assignments, aliases, provider references, and the admin Inputs workspace.

### Modified Capabilities

- `admin-interface`: Add Inputs before Questions and expose safe canonical-input editing with shared mutation protection.
- `actuals-sync-review`: Derive and store actual values using canonical entity references while preserving legacy migration and review semantics.
- `admin-race-result-review-workspace`: Make Race data and selected-round details resolve driver/team identity through canonical season inputs.

## Impact

- Additive PostgreSQL/SQLite schema and migrations for canonical entities, aliases, provider references, season membership, and assignments.
- Update roster/race loading, question option resolution, response serialization, leaderboard comparison, actuals derivation, and Race data audit view models.
- Add admin routes/templates/styles and localized labels for Inputs and identity mapping states.
- Add migration/backfill tooling and tests for existing name-based answers, actuals, evidence, and preview data.
- Production data remains unchanged until the migration is explicitly approved; preview uses a separate sanitized database.
