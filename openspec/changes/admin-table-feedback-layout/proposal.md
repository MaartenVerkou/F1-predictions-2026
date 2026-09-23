## Why

Admin feedback currently appears between table controls and the table, which makes the table feel interrupted and causes success/error/confirmation messages to compete with primary actions. Table headers and first rows also lack a consistent boundary, so similar admin tables do not share a clear visual rhythm.

## What Changes

- Establish one shared admin table presentation with a clear header underline, first-row boundary, compact cell spacing, and predictable toolbar-to-table spacing.
- Place inline success, error, warning, and informational messages in a dedicated context area above the table toolbar instead of inside the toolbar/table gap.
- Apply the shared presentation to Inputs, Race data, Actuals, Overview, and Questions tables without changing resource-specific columns or actions.
- Keep action toolbars visually separate from status feedback and preserve accessible focus/alert semantics.

## Capabilities

### New Capabilities

### Modified Capabilities

- `admin-interface`: Admin table feedback and table-boundary presentation are standardized across admin pages.

## Impact

- Shared admin CSS, table/toolbar partials, and message rendering in the admin EJS views.
- No database, route, API, or production data changes.
- Existing localized message content and action capabilities remain intact.
