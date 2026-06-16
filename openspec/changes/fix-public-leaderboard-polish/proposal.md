## Why

The global leaderboard is intended to be publicly readable, but anonymous users can still encounter login redirects from stale entry points or browser state. The page also needs a focused polish pass so the new trend, table, and insight surfaces feel consistent on desktop, phones, light mode, and dark mode.

## What Changes

- Ensure every public global leaderboard entry point links directly to `/global/leaderboard` for anonymous visitors.
- Preserve the existing protection for private group leaderboards and detailed prediction breakdown rows.
- Improve the leaderboard layout, chart, table, insight panel, and locked breakdown prompt for large screens, phones, light mode, and dark mode.
- Add regression coverage for anonymous navigation from the home leaderboard preview, direct global access, and private group protection.
- Verify the page with Playwright visual checks across desktop/mobile and light/dark themes.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `leaderboard-insights`: Public global leaderboard entry points and responsive/theme presentation quality.

## Impact

- Affected server-side route data in `src/routes/auth.js`.
- Affected leaderboard view and styling in `views/leaderboard.ejs` and `public/styles.css`.
- Affected Playwright coverage in `tests/e2e/leaderboard-insights.spec.js`.
- No data model, dependency, backup, Docker, or deployment workflow changes.
