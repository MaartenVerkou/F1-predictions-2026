## Why

The current Inputs page exposes low-level assignment records, so a simple driver swap requires manually editing round boundaries and creating a second record. This makes the season lineup hard to understand and leaves the assignment history disconnected from the round-specific context used by race data and actuals.

## What Changes

- Add a team-centric Season lineup editor with a selected effective round.
- Allow an admin to set both team seats in one protected, atomic save operation.
- Automatically close superseded assignments at the prior round and create replacement assignments from the selected round.
- Support driver swaps and mid-season replacements without exposing interval bookkeeping in the primary UI.
- Keep assignment history and canonical identity/mapping tools available under an advanced view.
- Add a safe canonical-driver creation path for a replacement driver not yet in the season catalog.
- Make downstream round-specific resolution use the canonical lineup without rewriting imported historical result provenance.
- Preserve admin authorization, CSRF protection, audit logging, and production safety.

## Capabilities

### New Capabilities

- `season-lineup-editor`: Edit and inspect a season's two-seat team lineup by effective round, with atomic replacement and swap behavior.

### Modified Capabilities

- None.

## Impact

- Admin Inputs route, templates, localized labels, and responsive presentation.
- Season assignment repository/service, including transactional interval splitting and seat validation.
- Canonical driver creation/membership flow for new mid-season entrants.
- Race-data, actuals, and question option resolution at a selected round.
- Preview seed and targeted tests; production database and deployment remain unchanged until explicit preview approval.
