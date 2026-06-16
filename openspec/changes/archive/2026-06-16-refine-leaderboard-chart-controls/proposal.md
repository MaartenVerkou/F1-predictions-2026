## Why

The desktop leaderboard/chart split should feel like one natural comparison surface. The current chart legend repeats leaderboard information and uses vertical space inefficiently, while the table headers still leave small but unnecessary width in a compact layout.

## What Changes

- Show `POS` as the visible position header.
- Keep the latest-race movement column accessible while removing its visible header text.
- Replace chart legend links with compact checkbox controls that toggle plotted participants.
- Remove repeated point totals from the chart legend controls.
- Lay the legend controls in compact columns below the graph and keep the desktop table/chart heights visually comparable.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `leaderboard-insights`: Refine chart controls and compact leaderboard presentation.

## Impact

- `views/leaderboard.ejs`
- `public/styles.css`
- `public/app.js`
- `tests/e2e/leaderboard-insights.spec.js`
