## 1. Admin Responsive Cleanup

- [ ] 1.1 Replace Season actuals inline layout/styles with reusable admin/actuals classes.
- [ ] 1.2 Make Season actuals question controls, DNF race inputs, target selector, review panels, and save row fit phone-width screens.
- [ ] 1.3 Wrap wide admin overview/detail/analysis tables in reusable scroll regions and keep action cells compact.
- [ ] 1.4 Clean up duplicated admin page header/action-row/detail-table styling without changing admin behavior.

## 2. Localization Pass

- [ ] 2.1 Move hard-coded leaderboard insight, chart, snapshot, empty-state, and sign-in copy into locale keys.
- [ ] 2.2 Add admin/admin-actuals locale keys used by changed templates.
- [ ] 2.3 Improve Dutch strings across public pages to remove English leftovers, mojibake, and mixed-language labels where practical.
- [ ] 2.4 Verify locale JSON remains valid and English fallback text still reads correctly.

## 3. Verification

- [ ] 3.1 Add or update Playwright coverage for mobile admin actuals/table overflow and Dutch leaderboard copy.
- [ ] 3.2 Run `npm run lint`, `npm test`, `npm run build`, and focused or full Playwright tests.
- [ ] 3.3 Run browser visual checks for admin actuals and leaderboard in desktop/mobile and light/dark themes.
- [ ] 3.4 Validate OpenSpec structure manually because the local `openspec` CLI is not available in this shell.
