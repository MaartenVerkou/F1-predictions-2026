## Why

The production workflow is now in place, so the next visible weakness is day-to-day usability. Admin pages, especially Season actuals, still use wide inline layouts and unwrapped tables that break on phone screens. The Dutch experience is also inconsistent: leaderboard and surrounding pages still show English words such as leaderboard, actuals, race change, strengths, and sign-in prompts.

## What Changes

- Polish admin pages so actuals, analysis, overview, user/group/guest details, tables, actions, and input groups fit cleanly on desktop and phone.
- Replace fragile inline admin layout styles with reusable classes where that improves maintainability.
- Localize the leaderboard insight panel, chart accessibility labels, empty states, snapshot/review labels, and related public navigation text.
- Clean Dutch copy across the main user-facing pages to avoid English leftovers where a natural Dutch label exists.
- Preserve current admin behavior, scoring, snapshot selection, automatic actuals flow, security gates, and deployment behavior.

## Capabilities

### New Capabilities
- `admin-interface`: Responsive and maintainable admin page presentation.
- `localized-interface`: Consistent Dutch copy across user-facing pages.

### Modified Capabilities
- `leaderboard-insights`: Leaderboard insight copy and accessibility labels use locale strings.

## Impact

- Affected templates: admin EJS views, leaderboard view, shared admin partials where needed.
- Affected styles: shared admin/table/form CSS and leaderboard text-related styling if needed.
- Affected locale files: `locales/en.json` and `locales/nl.json`.
- Affected tests: Playwright admin/leaderboard coverage and any relevant unit/build checks.
- No database schema, Docker, backup, R2, or deployment workflow changes.
