## 1. Season context and lifecycle

- [x] 1.1 Add a shared season catalog/context resolver that returns season identity, status, editability, syncability, and data counts without falling back from an invalid requested season.
- [x] 1.2 Replace the Inputs numeric season field and Open button with a labeled season selector and preserve the selected season across tabs, rounds, redirects, and mutation forms.
- [x] 1.3 Add server-side lifecycle guards for planned, active, and archived seasons, including explicit historical/preparation confirmation and active-season-only automatic sync.
- [x] 1.4 Add season-context coverage for missing, planned, active, and archived seasons in route and permission tests.

## 2. Canonical driver/team data integrity

- [x] 2.1 Audit and harden the canonical tables and repository helpers so immutable driver/team identities, season membership, driver numbers, display order, and active state remain separate.
- [x] 2.2 Add shared effective-round projection validation for non-overlapping driver intervals, team-seat occupancy, and duplicate driver occupancy.
- [x] 2.3 Route Inputs, Race data, Questions option resolution, and Actuals display lookups through the same effective-round projection service.
- [x] 2.4 Add regression tests for renames, driver numbers, team swaps, mid-season replacement, round boundaries, and historical evidence identity preservation.

## 3. Reusable admin table interaction

- [x] 3.1 Extract shared admin table shell, toolbar, row-selection, inline-editor, confirmation, empty-state, and bounded-scroll styles/partials without hiding resource-specific column markup.
- [x] 3.2 Extend the shared table behavior with resource capability flags so add, edit, deactivate, reorder, remove, and resolve actions only appear where valid.
- [x] 3.3 Migrate Drivers and Races to the shared table contract, hiding raw IDs, internal slugs, and other technical fields from primary tables.
- [x] 3.4 Keep Teams as the primary lineup table and align its toolbar, active state, round context, and order arrows with the shared contract.

## 4. Assignments and mappings workflows

- [x] 4.1 Replace the primary assignment create/edit form with a read-only Line-up history table showing driver, team, seat, from round, and to round only.
- [x] 4.2 Keep low-level assignment mutation available only as a guarded compatibility/advanced path and direct normal changes to the round-aware lineup editor.
- [x] 4.3 Build a mapping queue read model for unresolved aliases/provider references with provider, source label/key, entity type, candidate, status, and one Resolve action.
- [x] 4.4 Remove raw Entity ID and provider CRUD forms from the primary Mappings view while retaining auditable alias/provider records internally.

## 5. Season-aware downstream admin pages

- [x] 5.1 Make Race data use the selected season and selected round context for calendars, evidence, lineup labels, and empty/future states.
- [x] 5.2 Make Actuals read and review snapshots for the selected season while preventing historical/planned inspection from changing active-season live actuals.
- [x] 5.3 Mark Questions settings explicitly global and preserve existing scoring behavior until a separate season-specific question configuration is designed.
- [x] 5.4 Propagate season context through navigation, redirects, form actions, and selected-round URLs across Inputs, Race data, Actuals, and related admin links.

## 6. Preview fixtures and verification

- [x] 6.1 Add sanitized planned, active, and archived season fixtures with coherent canonical identities and at least one round-bounded replacement.
- [x] 6.2 Add focused tests for season switching, lifecycle guards, table capabilities, mapping resolution, and cross-page context propagation.
- [x] 6.3 Run lint, unit/integration tests, OpenSpec strict validation, and critical Playwright flows against the sanitized preview.
- [x] 6.4 Refresh the existing preview image and verify Inputs → Questions → Race data → Actuals, `/healthz`, and production isolation before requesting approval.
