## 1. Admin Responsive Cleanup

- [x] 1.1 Replace Season actuals inline layout/styles with reusable admin/actuals classes.
- [x] 1.2 Make Season actuals question controls, DNF race inputs, target selector, review panels, and save row fit phone-width screens.
- [x] 1.3 Wrap wide admin overview/detail/analysis tables in reusable scroll regions and keep action cells compact.
- [x] 1.4 Clean up duplicated admin page header/action-row/detail-table styling without changing admin behavior.

## 2. Localization Pass

- [x] 2.1 Move hard-coded leaderboard insight, chart, snapshot, empty-state, and sign-in copy into locale keys.
- [x] 2.2 Add admin/admin-actuals locale keys used by changed templates.
- [x] 2.3 Improve Dutch strings across public pages to remove English leftovers, mojibake, and mixed-language labels where practical.
- [x] 2.4 Verify locale JSON remains valid and English fallback text still reads correctly.

## 3. Verification

- [x] 3.1 Add or update Playwright coverage for mobile admin actuals/table overflow and Dutch leaderboard copy.
- [x] 3.2 Run `npm run lint`, `npm test`, `npm run build`, and focused or full Playwright tests.
- [x] 3.3 Run browser visual checks for admin actuals and leaderboard in desktop/mobile and light/dark themes.
- [x] 3.4 Validate OpenSpec structure manually because the local `openspec` CLI is not available in this shell.
