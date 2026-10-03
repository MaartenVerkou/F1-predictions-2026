## Why

Archived seasons are correctly protected by the server, but the Inputs UI does not provide a usable way to confirm a historical correction. The Assignments and Mappings tabs also expose implementation-oriented views in the primary workflow even though Teams is now the safe lineup editing boundary.

## What Changes

- Add one reusable historical-correction confirmation flow for every season-scoped Inputs mutation, including team ordering, entity edits, add/remove actions, lineup edits, and mapping resolution.
- Show a compact archived-season policy banner below the season selector and open an accessible confirmation dialog only when an archived mutation is submitted.
- Keep server-side lifecycle enforcement and audit logging as the source of truth; the UI confirmation must be propagated with the submitted mutation.
- Remove Assignments from the primary Inputs tab strip while preserving the normalized assignment data and a read-only advanced history view.
- Replace the primary Mappings tab with a conditional Data quality view that appears when unresolved or conflicting source mappings need attention.
- Keep resolved aliases and provider references in the database for imports, historical resolution, and auditability.
- Leave Race data read-only and keep Actuals' past-race unlock workflow separate, while aligning wording and presentation where useful.

## Capabilities

### New Capabilities

- `historical-admin-edits`: Consistent, explicit confirmation and audit behavior for archived-season corrections.

### Modified Capabilities

- `admin-interface`: Simplify the Inputs information architecture while retaining advanced assignment history and source-mapping workflows.

## Impact

- Affected routes: season-scoped Inputs mutations and their redirects, plus the Inputs page view model.
- Affected views and client code: Inputs season policy banner, shared confirmation dialog, mutation forms, primary tabs, and advanced/read-only states.
- Affected tests: lifecycle mutation coverage, rendered Inputs controls, mapping/assignment visibility, and preview browser flow.
- No production database migration is required; canonical assignments, aliases, provider references, and audit events remain intact.
