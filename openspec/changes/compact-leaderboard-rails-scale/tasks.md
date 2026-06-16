## 1. Verification

- [x] 1.1 Add or update Playwright coverage for compact legend/table rails on desktop.
- [x] 1.2 Add Playwright coverage that the chart domain lower bound is non-zero when current focus totals allow it and below-domain points remain inside the plot.
- [x] 1.3 Preserve existing mobile/light/dark layout coverage.

## 2. Implementation

- [x] 2.1 Compute a rounded chart Y-domain from latest visible focus-set totals and clamp plotted points into that domain.
- [x] 2.2 Render chart domain metadata and updated axis labels.
- [x] 2.3 Replace fixed desktop legend/table widths with bounded content-aware sizing.
- [x] 2.4 Adjust the lower desktop grid so the compact ranking table no longer forces a 50/50 split with details.

## 3. Validation

- [x] 3.1 Run OpenSpec validation.
- [x] 3.2 Run lint, build, unit tests, and relevant Playwright tests.
- [x] 3.3 Inspect the leaderboard visually on desktop and phone widths.
