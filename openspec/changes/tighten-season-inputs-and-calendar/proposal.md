## Why

The Season inputs page still spends space on instructions that are obvious from the controls, while action buttons appear only after selection and make available operations hard to discover. The race table also lacks the scheduled start date/time needed to audit the calendar and align evidence with each round.

## What Changes

- Remove the redundant seat-period helper sentence from the Teams view.
- Tighten vertical spacing between the season selector, tabs, toolbars, guidance, and tables while preserving readable grouping.
- Keep applicable table actions visible at all times, disabled until a row is selected, so the available workflow is discoverable.
- Store and display each race's scheduled start date/time in the season race inputs and seed data.
- Populate the 2026 calendar from an authoritative Formula 1 calendar source and preserve future-year support through nullable scheduled timestamps.
- Keep production unchanged; validate the calendar and UI changes in the sanitized PostgreSQL preview first.

## Capabilities

### New Capabilities

- `season-calendar-inputs`: Persist and present scheduled race start timestamps for each season race.

### Modified Capabilities

- `admin-interface`: Make season-input tables denser, remove redundant guidance, and keep applicable actions visible but disabled when no row is selected.

## Impact

- Affected templates: `views/admin_inputs.ejs`.
- Affected shared styles and table-action behavior: `public/styles.css`, admin table JavaScript, and rendered-view tests.
- Affected season-input schema, seed data, and race catalog projections for scheduled timestamps.
- Preview PostgreSQL data will receive the 2026 calendar timestamps; no production database or deployment is changed.
