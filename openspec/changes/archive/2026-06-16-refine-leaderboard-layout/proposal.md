## Why

The leaderboard now exposes richer movement and participant context, but the current desktop layout makes the detail panel compete with the ranking table and the change column visually overstates unchanged rows. The page should feel like a conventional classement: scan the ranking first, see movers quickly, then inspect selected-person details below.

## What Changes

- Make unchanged latest-race movement less prominent than actual movers.
- Narrow the latest-race movement column and remove the verbose visible `CHANGE` header text.
- Rework the leaderboard layout so the rank table uses the main width and selected participant details appear below it instead of beside it.
- Reduce nested board/card treatment inside the leaderboard area while keeping chart, table, and details visually organized.
- Preserve existing scoring, selected participant behavior, pagination, public access, and private group protections.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `leaderboard-insights`: Latest-race movement display and leaderboard/detail presentation flow.

## Impact

- Affected leaderboard template: `views/leaderboard.ejs`.
- Affected leaderboard styling: `public/styles.css`.
- Affected Playwright coverage: `tests/e2e/leaderboard-insights.spec.js`.
- No database, Docker, backup, security, or deployment workflow changes.
