## 1. Data Model Builders

- [x] 1.1 Extract reusable leaderboard scoring helpers so historical snapshot scoring can be tested without rendering the route.
- [x] 1.2 Build a snapshot history model that scores the leaderboard for each valid actual snapshot round.
- [x] 1.3 Build the leaderboard focus set from current top 10, logged-in participant, and selected participant.
- [x] 1.4 Build latest-race movement data by comparing the latest valid actual snapshot against the previous valid actual snapshot.
- [x] 1.5 Build selected-participant insight data using nearby ranked participants and question-level score differences.
- [x] 1.6 Build selected-participant breakdown data with scored-only and all-question modes.

## 2. Route Integration

- [x] 2.1 Add selected participant handling to the leaderboard route with logged-in participant fallback and P1 fallback.
- [x] 2.2 Add chart history, focus set, latest-race movement data, insight data, and breakdown data to the leaderboard render model.
- [x] 2.3 Preserve existing snapshot selection, access control, pagination, and admin analysis leaderboard behavior.
- [x] 2.4 Add safe empty states for insufficient snapshot history, no scored questions, and selected participants without scored rows.

## 3. User Interface

- [x] 3.1 Add the points-over-time chart to the leaderboard page using the server-provided chart model.
- [x] 3.2 Visually emphasize selected and logged-in participants while keeping ordinary top-10 lines muted.
- [x] 3.3 Add latest-race movement to leaderboard rows showing latest-vs-previous points gained and rank movement.
- [x] 3.4 Add a selected-participant insight panel explaining gaps, strengths, and distinctive predictions.
- [x] 3.5 Add an expandable question breakdown that defaults to scored questions and toggles to all questions.
- [x] 3.6 Ensure mobile and desktop layouts keep chart labels, latest-race movement, insights, and breakdown text readable without overlap.

## 4. Verification

- [x] 4.1 Add unit tests for snapshot history, focus set, latest-race movement, selected-participant insights, and breakdown filtering.
- [x] 4.2 Add or update Playwright coverage for chart visibility, selected participant switching, latest-race movement, and scored/all breakdown toggle.
- [x] 4.3 Run `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e`.
- [x] 4.4 Validate the OpenSpec change with `openspec validate enhance-leaderboard-insights --type change --strict`.
- [x] 4.5 Run a local visual check of the leaderboard on desktop and mobile viewports before deployment.
