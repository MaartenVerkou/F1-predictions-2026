## Why

The Season Actuals table still has multiple presentation paths for the same answer. Compact entity lists are pre-grouped into lines and code lines are explicitly `nowrap`, so narrow cells clip or wrap differently depending on the answer shape. The table also has overlapping responsive width rules. We need one predictable, compact presentation contract before more questions or entity types are added.

## What Changes

- Introduce one shared Actuals cell projection that normalizes scalar, structured, and entity-list answers into a full accessible value plus one bounded compact display value.
- Deduplicate entity values and apply one generic abbreviation/overflow policy without branching on individual question IDs.
- Render one shared value block per cell; remove presentation behavior that pre-wraps answer lines or disables wrapping for compact codes.
- Apply the same `white-space`, overflow, line-clamp, and accessible full-value rules to names, codes, numbers, statuses, and future answer kinds.
- Use one shared responsive width policy with only normal and compact modes; remove overlapping breakpoint-specific cell width overrides.
- Preserve complete canonical answers in title and ARIA labels, and keep scoring, stored snapshots, and database values unchanged.
- Add unit, layout, and Playwright regression coverage for long lists, duplicate entities, structured answers, statuses, and supported viewport widths.

## Capabilities

### New Capabilities

- `actuals-table-presentation`: Defines the shared normalization, compaction, accessibility, and wrapping contract for the Season Actuals overview.

### Modified Capabilities

- `admin-interface`: Clarifies that the Actuals table uses one compact responsive mode in addition to the normal desktop mode, with bounded cell content and no page-level overflow.

## Impact

- `src/actuals-overview.js` and related shared answer-formatting helpers.
- `views/admin_actuals.ejs` and `public/styles.css`.
- Actuals unit/layout tests and Playwright responsive checks.
- No schema, scoring, snapshot, or production-data migration; the change affects only the read-model projection and presentation layer.
