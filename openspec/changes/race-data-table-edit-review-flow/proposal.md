## Why

Race Data currently exposes a row-selection editor even though a correction can affect the complete result matrix and every derived answer. That interaction hides the scope of a correction, leaves the review controls visually disconnected from the round title, and makes the existing “Reviewed” label inaccurate after a manual edit.

## What Changes

- Replace row selection plus the disabled single-row editor with one `Edit data` action for the selected snapshot.
- Let the admin edit the persisted race-result table in place, including all visible result/session fields, with explicit Save and Discard actions.
- Keep corrections protected with validation, a required reason, confirmation, revision history, and re-derivation of actuals.
- Treat a saved manual correction as reviewed and publish the re-derived snapshot immediately; label it `Edited by …` with the reviewer and compact timestamp.
- Align the review state/action and edit action with the round heading and remove redundant toolbar bottom spacing.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-race-result-review-workspace`: change the selected-round toolbar and replace row-scoped correction with full-table editing and clear edited/reviewed identity.
- `actuals-sync-review`: make a protected full-table correction an auditable, immediately reviewed and published snapshot.

## Impact

- Race Data round-region template, shared admin CSS, and the Race Data client controller.
- The admin correction endpoint and persisted evidence payload normalization for race and session rows.
- End-to-end and layout tests for review, correction, validation, and responsive toolbar behavior.
