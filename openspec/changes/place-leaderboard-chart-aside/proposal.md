## Why

The leaderboard table is the primary scanning surface, while the points-over-rounds graph is useful context. On desktop the graph should support the ranking without forcing users to scroll past it or competing with selected-participant details.

## What Changes

- Place the points-over-rounds graph to the right of the leaderboard on wide screens as a lightweight companion panel.
- Keep selected-participant details and question breakdown below the leaderboard/chart row.
- Keep phone layouts stacked and readable, with no horizontal page overflow.
- Preserve existing chart behavior, participant selection, public global leaderboard access, and detailed breakdown access rules.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `leaderboard-insights`: Refine desktop presentation so the trend graph can sit beside the leaderboard while deeper selected-participant details remain below.

## Impact

- `views/leaderboard.ejs`
- `public/styles.css`
- `tests/e2e/leaderboard-insights.spec.js`
