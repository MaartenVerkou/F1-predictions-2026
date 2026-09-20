## Why

The Season actuals page repeats the same review backlog, sync status, race timeline, and edit status in multiple large blocks. An admin's real task is to select one race, verify that its interpretation matches the answers that were in force at that round, and approve the snapshot.

## What Changes

- Replace the redundant review summaries with one compact review workspace.
- Make the race selector the primary control, with one compact pending/reviewed state line.
- Present the selected race's answer-at-the-time context next to its interpreted actual results and review action.
- Keep editing and approval scoped to the selected snapshot, without changing which latest reviewed snapshot drives live scoring.

## Capabilities

### New Capabilities

- `admin-race-result-review-workspace`: A focused admin workspace for inspecting and approving one race-result snapshot at a time.

### Modified Capabilities

- `actuals-sync-review`: Clarify the selected-snapshot review workflow and the context required to validate result interpretation.
- `admin-interface`: Require the Season actuals review controls to avoid redundant operational summaries.

## Impact

- Affects the admin Season actuals route, its view model/template and its focused UI tests.
- Reuses existing snapshot, answer, actuals, authorization, CSRF, and scoring behaviour; no new external dependencies or public API changes.
