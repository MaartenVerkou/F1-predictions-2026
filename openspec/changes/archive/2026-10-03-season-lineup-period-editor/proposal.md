## Why

The current team editor asks an administrator to choose an effective race before changing a lineup. That makes a normally stable season roster look like a separate decision for every race and hides the actual business concept: a driver occupies a team seat for a bounded period. A period-based team view will make the common case (R1–present) compact while still handling a mid-season replacement clearly.

## What Changes

- Replace the primary round-specific team lineup controls with a team-centered season lineup history view.
- Show each team's seat 1 and seat 2 as ordered assignment periods with driver, start round, and end round/present.
- Allow an administrator to add, edit, remove, and save assignment periods for one team in one atomic operation.
- Select drivers from the canonical season driver catalog; do not create ad-hoc driver names in an assignment.
- Keep normalized round-bounded assignment rows and overlap validation as the persistence contract.
- Require an explicit historical-correction confirmation when a change affects rounds with imported evidence or reviewed actuals.
- Keep the all-assignments view as a secondary read-only diagnostic view; remove the round selector from the primary team workflow.
- Preserve existing downstream round resolution, authorization, CSRF protection, audit logging, and production safety.

## Capabilities

### New Capabilities

- `season-lineup-period-editor`: Manage a season's team-seat assignment history as clear driver periods.

### Modified Capabilities

- None.

## Impact

- Admin Inputs route, team table/editor template, localized labels, and shared table styling.
- Season lineup service and assignment validation, including a transactional per-team history command.
- Targeted admin and service tests, preview fixtures, and preview deployment only.
- No production database copy or production deployment is part of this change.
