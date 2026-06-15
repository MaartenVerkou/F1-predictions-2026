## 1. Data Model Builders

- [ ] 1.1 Extract reusable leaderboard scoring helpers so historical snapshot scoring can be tested without rendering the route.
- [ ] 1.2 Build a snapshot history model that scores the leaderboard for each valid actual snapshot round.
- [ ] 1.3 Build the leaderboard focus set from current top 10, logged-in participant, and selected participant.
- [ ] 1.4 Build round mover data by comparing the latest valid actual snapshot against the previous valid actual snapshot.
- [ ] 1.5 Build selected-participant insight data using nearby ranked participants and question-level score differences.
- [ ] 1.6 Build selected-participant breakdown data with scored-only and all-question modes.

## 2. Route Integration

- [ ] 2.1 Add selected participant handling to the leaderboard route with logged-in participant fallback and P1 fallback.
- [ ] 2.2 Add chart history, focus set, round movers, insight data, and breakdown data to the leaderboard render model.
- [ ] 2.3 Preserve existing snapshot selection, access control, pagination, and admin analysis leaderboard behavior.
- [ ] 2.4 Add safe empty states for insufficient snapshot history, no scored questions, and selected participants without scored rows.

## 3. User Interface

- [ ] 3.1 Add the points-over-time chart to the leaderboard page using the server-provided chart model.
- [ ] 3.2 Visually emphasize selected and logged-in participants while keeping ordinary top-10 lines muted.
- [ ] 3.3 Add a round movers panel showing latest-vs-previous points gained and rank movement.
- [ ] 3.4 Add a selected-participant insight panel explaining gaps, strengths, and distinctive predictions.
- [ ] 3.5 Add an expandable question breakdown that defaults to scored questions and toggles to all questions.
- [ ] 3.6 Ensure mobile and desktop layouts keep chart labels, movers, insights, and breakdown text readable without overlap.

## 4. Verification

- [ ] 4.1 Add unit tests for snapshot history, focus set, round movers, selected-participant insights, and breakdown filtering.
- [ ] 4.2 Add or update Playwright coverage for chart visibility, selected participant switching, round movers, and scored/all breakdown toggle.
- [ ] 4.3 Run `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e`.
- [ ] 4.4 Validate the OpenSpec change with `openspec validate enhance-leaderboard-insights --type change --strict`.
- [ ] 4.5 Run a local visual check of the leaderboard on desktop and mobile viewports before deployment.
