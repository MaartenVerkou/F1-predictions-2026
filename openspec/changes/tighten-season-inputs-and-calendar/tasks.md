## 1. Calendar data model and seed flow

- [ ] 1.1 Add nullable `scheduled_timezone` to SQLite/PostgreSQL race schemas and startup normalization.
- [ ] 1.2 Add the official 2026 race-start map keyed by existing canonical race names, including UTC instants and venue timezones.
- [ ] 1.3 Update race upsert, season seeding, preview season copying, and admin edits to preserve both schedule fields without changing round numbering.
- [ ] 1.4 Add model/seed tests for scheduled fields, missing schedules, timezone formatting inputs, and name-keyed updates.

## 2. Inputs UI and action behavior

- [ ] 2.1 Remove the redundant Teams helper sentence and tighten the Season inputs vertical rhythm.
- [ ] 2.2 Keep supported Drivers, Teams, and Races actions visible and disabled until selection; remove obsolete hide-until-selection client behavior.
- [ ] 2.3 Add the localized race start column with accessible local-time metadata and update editor colspans.
- [ ] 2.4 Add rendered-view and client behavior assertions for compact layout and visible-disabled actions.

## 3. Verification and preview

- [ ] 3.1 Run syntax/lint, focused tests, full Node 22 tests, and strict OpenSpec validation.
- [ ] 3.2 Rebuild the sanitized PostgreSQL preview from the implementation commit and seed schedule data for the preview seasons.
- [ ] 3.3 Verify the Teams toolbar/table spacing, visible disabled actions, and race start times in the preview browser; leave production unchanged.
