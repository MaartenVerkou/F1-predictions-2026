## 1. Catalog schema and migration

- [ ] 1.1 Add idempotent PostgreSQL/SQLite-compatible tables for definition terms, translations, aliases, and question bindings, including uniqueness and active/archive fields.
- [ ] 1.2 Seed the existing global and question-scoped tooltip definitions for all supported locales without changing question, answer, actuals, or race-data records.
- [ ] 1.3 Add schema and seed tests proving reruns are idempotent and the current global/scoped inventory is preserved.

## 2. Shared definition domain logic

- [ ] 2.1 Implement the definition loader with locale fallback, active filtering, global bindings, and question bindings.
- [ ] 2.2 Implement safe alias matching and structured tooltip spans with overlap handling and HTML-safe output data.
- [ ] 2.3 Replace duplicated term arrays and matching loops in Questions and Responses with the shared definition logic.
- [ ] 2.4 Add unit tests for global terms, scoped terms, overlapping aliases, inactive terms, missing translations, and unchanged scoring semantics.

## 3. Public definitions experience

- [ ] 3.1 Add the public locale-aware Definitions route and two-column term/explanation page.
- [ ] 3.2 Add a public Questions link to Definitions and replace the duplicate static About definitions list with a link.
- [ ] 3.3 Add responsive and accessible styling for the definitions table and keyboard-visible tooltips.
- [ ] 3.4 Add route and Playwright coverage for public access, locale fallback, tooltip parity, and archived-term visibility.

## 4. Admin Inputs integration

- [ ] 4.1 Add Definitions to the Inputs navigation and route model without changing existing Drivers, Teams, Races, or Scoring behavior.
- [ ] 4.2 Add the Definitions table with term, scope, aliases, translations, order, and active state using the shared admin toolbar/table patterns.
- [ ] 4.3 Add protected create, edit, reorder, activate, and archive actions with validation, CSRF protection, and audit logging.
- [ ] 4.4 Add admin tests for valid edits, duplicate/empty/malformed input rejection, ordering, archival, and binding changes.

## 5. Verification and cleanup

- [ ] 5.1 Run the full relevant unit suite and public/admin Playwright flows, including unchanged question scoring and Race Data review behavior.
- [ ] 5.2 Run strict OpenSpec validation, review the final diff for duplicated tooltip code and dead static definitions, rebuild the preview, and verify health and public/admin routes.
