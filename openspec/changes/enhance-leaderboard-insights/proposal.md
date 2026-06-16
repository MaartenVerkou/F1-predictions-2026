## Why

The leaderboard currently shows ranks, total points, snapshot selection, and per-person question details, but it does not explain how the race evolved over time or why a participant is winning, falling behind, or unusual. As actual snapshots now update after each completed race, the leaderboard can use that history to make the classement understandable without requiring admins or players to manually compare question tables.

## What Changes

- Add a leaderboard points-over-time view using saved actual snapshots as race-round milestones.
- Build the chart focus set from the current top 10 plus the logged-in participant and the selected participant when either is outside the top 10.
- Keep the selected participant and logged-in participant visually emphasized in the chart.
- Add leaderboard insights for the selected participant that explain gaps to nearby competitors above them, strengths versus nearby peers, and distinctive predictions or scoring patterns.
- Add latest-race movement in the leaderboard table, summarizing points gained and rank movement since the previous actual snapshot.
- Add an expandable question breakdown for the selected participant that defaults to scored questions and can toggle to all questions.
- Preserve existing leaderboard access control, pagination, snapshot selection, and scoring behavior.

## Capabilities

### New Capabilities
- `leaderboard-insights`: Historical leaderboard trends, focus-set charting, selected-participant insights, latest-race movement, and scored/all question breakdown behavior.

### Modified Capabilities
- None.

## Impact

- Affected application code: leaderboard route scoring/query logic in `server.js`, leaderboard rendering in `views/leaderboard.ejs`, shared browser behavior in `public/app.js`, and styles in `public/styles.css`.
- Affected data: reads existing `actual_snapshots` and `actual_snapshot_values`; no new production persistence is expected for the first implementation.
- Affected tests: unit coverage for trend/insight data builders and Playwright coverage for the leaderboard chart, selected participant behavior, scored-only breakdown toggle, and latest-race movement.
- No external service, authentication, or deploy workflow changes are expected.
