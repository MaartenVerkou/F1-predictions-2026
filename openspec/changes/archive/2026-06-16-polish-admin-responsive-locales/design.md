## Context

The admin pages were built incrementally and mix reusable styles with inline grid/flex/table decisions. This makes phone layout fragile and creates duplicated patterns for scrollable tables, page headers, action rows, and actuals input groups. The public leaderboard recently gained more insight UI, but much of the new copy stayed hard-coded in English, so Dutch users see mixed-language pages.

## Goals / Non-Goals

**Goals:**
- Make admin actuals usable on phone-width screens without page-level horizontal overflow.
- Make admin overview/detail/analysis tables use a consistent bounded-scroll pattern when columns are inherently wide.
- Keep admin action groups and form controls readable with predictable wrapping on desktop and phone.
- Move hard-coded leaderboard/admin strings that need localization into locale files.
- Improve Dutch strings that currently contain English words, mojibake, or awkward mixed-language phrasing.

**Non-Goals:**
- Changing scoring rules, actuals values, sync scheduling, or review state logic.
- Reworking admin permissions or adding new admin workflows.
- Translating source data such as driver names, team names, question identifiers, race names, or admin-only technical IDs.
- Replacing all admin English labels with Dutch-only labels; admin pages should follow the selected locale where practical, but technical data may remain as data.

## Decisions

### Use shared admin layout utilities

Admin pages SHALL use shared classes for page headers, action bars, section spacing, scrollable table regions, detail key-value tables, and form rows. This removes repeated inline styles and keeps future admin pages easier to fit on mobile.

Alternative considered: patching only Season actuals. That would fix the most visible issue but leave the same overflow pattern in overview/detail tables.

### Keep wide admin tables scrollable instead of compressing every column

Tables with many columns SHALL be wrapped in a horizontal scroll region with a clear min-width. Content cells that can wrap, such as IDs and answers, SHALL use overflow wrapping. Destructive/action cells SHALL stay compact and not force the whole page wider than the viewport.

Alternative considered: turning every admin table into stacked cards on mobile. That is a larger rewrite and would make dense admin scanning slower.

### Localize UI copy, not domain data

The templates SHALL call locale keys for labels, headings, empty states, action text, and accessibility labels. Driver/team/race names and saved user answers SHALL remain as stored data.

Alternative considered: translating only Dutch locale values while leaving template literals in English. That would keep mixed English for new hard-coded leaderboard text.

## Risks / Trade-offs

- Admin screenshots may still require horizontal scroll for intentionally wide tables -> Mitigate by ensuring scroll is inside the table region, not the whole page.
- Locale key growth can become noisy -> Mitigate by grouping keys under `admin`, `admin_actuals`, `admin_analysis`, and `leaderboard`.
- Changing admin labels may affect Playwright selectors -> Mitigate by updating tests to target localized text where behavior is relevant and stable classes for layout metrics.
