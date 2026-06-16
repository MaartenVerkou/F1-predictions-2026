## Why

The leaderboard still spends too much width on participant name rails even when names are short, leaving less room for the points trend. The trend chart also starts at zero, which wastes vertical resolution when the useful comparison is between current top participants.

## What Changes

- Make the chart legend and ranking table name areas more content-aware and compact on wide screens.
- Allow the ranking/details area below the chart to use a content-aware split instead of enforcing a strict 50/50 layout.
- Scale the points-over-rounds chart from a rounded useful lower bound derived from the visible focus set rather than always starting at zero.
- Default the leaderboard snapshot selector to the latest saved race snapshot instead of showing a separate `Current` option.
- Show race-to-previous-race movement for historical snapshots when a previous saved race exists.
- Mark the selected snapshot round subtly in the trend chart.
- Preserve readable mobile stacking, accessible labels, selected participant emphasis, and existing scoring behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `leaderboard-insights`: Refine leaderboard presentation so rails use less unnecessary width and trend charts focus on the relevant score band.

## Impact

- Affected template: `views/leaderboard.ejs`.
- Affected styles: `public/styles.css`.
- Affected client behavior/tests: `tests/e2e/leaderboard-insights.spec.js`, `tests/leaderboard-model.test.js` if chart-domain helpers move into the model.
- No new runtime dependencies or scoring model changes.
