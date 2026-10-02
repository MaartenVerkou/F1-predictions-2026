## Why

The admin review surfaces have drifted apart: Questions and Results still share a legacy page shell, compact controls are implemented differently across Race Data and Inputs, and the constructor “Results” view currently presents championship points instead of race finish evidence. The next release should make the review workflow predictable without changing the canonical race-data or scoring model.

## What Changes

- Split question configuration and question results into separate season-aware admin pages, while keeping `/admin/actuals` as a compatibility redirect to Results.
- Make the Questions page a focused input editor with the same compact toolbar and edit action pattern used by Race Data.
- Make Results a focused read-only answer matrix that reuses the existing bounded answer projection.
- Standardize compact segmented controls and responsive selects for Race Data content variants; hide the select label when the control itself is self-describing.
- Correct constructor Results semantics so Results shows finish positions and the same podium/PF/FL presentation as Drivers Results; Points remains the championship-points projection.
- Tighten Season Inputs team-table geometry with a shared centered order column and balanced identity columns.
- Display review metadata as reviewer plus date only, without a time-of-day.
- Remove obsolete combined-page templates/toggle markup and redundant styles only after route and test references are migrated.

## Capabilities

### New Capabilities

- `admin-question-results-pages`: Separate, season-aware Questions and Results admin surfaces with shared answer presentation and compatibility routing.

### Modified Capabilities

- `admin-race-result-review-workspace`: Align Race Data variant controls and constructor Results semantics with the shared Drivers/Constructors presentation contract.
- `admin-interface`: Apply shared compact toolbar, table, responsive-control, and review-metadata presentation rules across Questions, Results, Race Data, and Season Inputs.

## Impact

- Admin routes and templates under `src/routes/admin.js` and `views/`.
- Shared admin CSS and responsive control classes in `views/partials/admin_styles.ejs` (or the current shared stylesheet location).
- Question/Results and Race Data unit/e2e tests.
- No database migration or canonical data-source change; existing stored answers and race snapshots remain the source of truth.
- Deployment artifacts for the preview and production admin surfaces.
