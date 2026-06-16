## Why

The leaderboard currently gives the selected-participant detail area more visual weight than the leaderboard trend itself. The chart legend also behaves like a checkbox label only, which makes selecting a participant from the graph area less direct than expected.

## What Changes

- Reframe the leaderboard page as trend-first: show the points-over-rounds chart at the top with a right-side participant rail.
- Keep the participant rail as both chart legend and lightweight leaderboard context.
- Make clicking a legend item select that participant.
- Make only the legend checkbox toggle that participant's plotted chart visibility.
- Move the full ranking and selected-participant detail area below the trend section on wide screens.
- Preserve existing scoring, public global access, private group protection, breakdown filtering, and current-user/selected-user emphasis.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `leaderboard-insights`: Adjust leaderboard presentation and chart legend interaction requirements.

## Impact

- Affected template: `views/leaderboard.ejs`.
- Affected styles: `public/styles.css`.
- Affected client behavior: `public/app.js`.
- Affected verification: `tests/e2e/leaderboard-insights.spec.js`.
