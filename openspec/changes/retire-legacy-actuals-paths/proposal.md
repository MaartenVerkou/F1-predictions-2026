## Why

The Actuals admin route still contains an older live-provider autofill path that duplicates the persisted Race Data import and derivation pipeline. Keeping both paths makes it unclear which data is authoritative and leaves a large amount of dead parsing code to maintain.

## What Changes

- Remove the legacy “Preview autofill in form” endpoint, form action, and provider-fetch/parser implementation from the admin route.
- Keep Actuals review, manual correction, snapshot publication, and scoring unchanged; they continue to use persisted race evidence and season-scoped snapshots.
- Remove translation keys and tests that exist only for the retired autofill action.
- Add a focused regression check that the Actuals page exposes the canonical sync/review workflow without the legacy autofill action.
- Preserve all participant responses, groups, users, published actual snapshots, and race evidence data.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `actuals-sync-review`: Actuals synchronization is initiated through the persisted evidence import/derivation workflow; the legacy direct-provider autofill action is no longer available.

## Impact

- `src/routes/admin.js` and `views/admin_actuals.ejs` become smaller and have one less data path.
- Locales lose one unused admin action label.
- Admin Actuals tests are updated to assert the canonical workflow.
- No database tables or participant data are deleted. Production remains unchanged until separately approved.
