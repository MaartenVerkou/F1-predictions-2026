## 1. Route and template split

- [ ] 1.1 Add the season-aware `/admin/results` route and keep `/admin/actuals` plus legacy Questions result queries as compatibility redirects.
- [ ] 1.2 Simplify the Questions route/template to render only question inputs and its shared edit toolbar.
- [ ] 1.3 Add the focused Results page shell and reuse the existing question-results table partial.
- [ ] 1.4 Update admin navigation, locale labels, and route links to expose separate Questions and Results pages.
- [ ] 1.5 Remove or migrate obsolete combined-page templates, toggle partials, and their unused styles after references are gone.

## 2. Shared admin presentation

- [ ] 2.1 Extract or align the shared segmented-control, compact-select, edit-action, toolbar, and table-region classes used by Race Data, Questions, Results, and Inputs.
- [ ] 2.2 Remove the visible Content label from the narrow Race Data metric select while retaining an accessible name and compact styling.
- [ ] 2.3 Format visible Race Data review metadata as reviewer plus date without time-of-day.
- [ ] 2.4 Tighten the Season Inputs Teams table with the shared centered order column, wider team name, and equal compact driver columns.

## 3. Correct table semantics

- [ ] 3.1 Change constructor Results model selection to use race-result evidence and retain championship points as the Points projection.
- [ ] 3.2 Verify constructors Results reuses finish-position, podium, PF, and FL cell presentation from Drivers Results.

## 4. Verification and cleanup

- [ ] 4.1 Update unit and route/template tests for separate Questions, Results, and compatibility redirects.
- [ ] 4.2 Add regression coverage for constructor Results versus Points and review-date formatting.
- [ ] 4.3 Update Playwright coverage for Questions, Results, Race Data compact controls, and Teams layout at desktop and narrow widths.
- [ ] 4.4 Run focused tests, full project gates, strict OpenSpec validation, and review the final diff for stale code.
- [ ] 4.5 Deploy the verified image to preview, smoke-test critical admin flows, then promote the same image to production with health verification.
