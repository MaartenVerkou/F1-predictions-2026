## Why

The canonical Race Data workspace is functionally correct, but its review controls still compete with the data: the round control is not grouped with the season, each result row carries a large edit form, and the race-result columns do not follow the order an administrator uses to validate a race. A final interaction pass will make the workspace faster to scan without changing the evidence or derivation model.

## What Changes

- Place Season and Round in a compact, vertically aligned selector block at the top of the page.
- Start the workspace directly with the finish-order result table, without a redundant divider or title treatment.
- Make result rows selectable and move correction into one compact toolbar Edit action for the selected row; preserve the protected correction flow.
- Reorder result columns around race review: P1/P2/P3, qualifying, sprint, grid, status, and points, with the most useful available evidence shown first.
- Keep Drivers/Constructors and metric controls as one shared, responsive control group and make metric changes use the same table structure and visual language.
- Preserve the separate derivation-review section and its question-driven table selection.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `admin-race-result-review-workspace`: Refine the canonical race review controls, table order, and protected correction interaction without changing the underlying evidence contract.

## Impact

- Race Data route and shared admin Race Data partials/styles.
- Admin Race Data tests and browser smoke coverage.
- No schema, evidence, scoring, participant-response, or production data changes.
