## 1. Establish the WOK contract and release baseline

- [x] 1.1 Update `mhv-app.yaml` and related contract fixtures to use `wok` / Wheel of Knowledge as the canonical identity while recording `f1` as an explicit compatibility alias.
- [x] 1.2 Add contract tests and documentation assertions that registry slug, preview hostname pattern, repository, production domain, health endpoint, and database backend remain aligned.
- [x] 1.3 Capture the current admin routes, active OpenSpec changes, worktrees, and untracked files in a reviewable cleanup inventory without deleting user files.

## 2. Build the shared admin presentation layer

- [x] 2.1 Add semantic admin design tokens for spacing, control height, table density, radius, borders, typography, and light/dark surfaces.
- [x] 2.2 Add reusable EJS partials/classes for the admin page heading, toolbar/action group, segmented control, bounded table shell, and status/metadata line.
- [x] 2.3 Add shared focus, disabled, hover, reduced-motion, and compact responsive states for those primitives.
- [x] 2.4 Add focused rendered-template assertions for the shared primitives and ensure no equivalent inline styles are introduced.

## 3. Migrate admin surfaces in vertical slices

- [x] 3.1 Migrate Race Data to the shared shell as the reference slice without changing evidence, derivation, or correction behavior.
- [x] 3.2 Migrate Results and Questions to the same toolbar, segmented control, table shell, and status metadata contract.
- [x] 3.3 Migrate Season Inputs, Definitions, and scoring tables, preserving selection/edit/reorder behavior and compact phone layout.
- [x] 3.4 Migrate analysis, user/group detail, and remaining admin tables where the shared contract applies; retain explicit variants for genuinely different data shapes.
- [x] 3.5 Add representative Playwright coverage for desktop/mobile and light/dark states, including table-local scrolling and keyboard focus.

## 4. Simplify admin code and measure runtime behavior

- [x] 4.1 Extract clearly bounded admin presentation/review helpers from `src/routes/admin.js` without changing the canonical scoring/evidence APIs.
- [x] 4.2 Add sampled request-duration and heap observations with sensitive fields excluded from logs.
- [ ] 4.3 Measure repeated derivation work for a season/round/revision and add revision-keyed caching only where the measurement demonstrates a benefit; invalidate on refresh/correction.

## 5. Repository and OpenSpec cleanup

- [ ] 5.1 Classify active OpenSpec changes as active, completed, superseded, or historical and archive only verified completed/superseded changes using the approved workflow.
- [ ] 5.2 Remove verified disposable probe files and archive unused managed worktrees without touching user-owned changes, secrets, production state, or database backups.
- [x] 5.3 Run strict OpenSpec validation and review the final diff for duplicated CSS, dead classes, accidental data changes, and unrelated edits.

## 6. Release verification

- [ ] 6.1 Run lint, unit tests, build, Playwright, dependency/security checks, and live MHV registry validation.
- [ ] 6.2 Refresh the Apps Hub preview from the immutable image, verify `/healthz`, and inspect the migrated admin pages before production.
- [ ] 6.3 After explicit preview approval, merge the latest main, deploy the approved immutable GHCR digest, verify production health/database backend, and retain the rollback image.

> Verification note: lint, the 261-test unit suite, build, full Playwright suite
> (34 tests), and `npm audit --omit=dev --audit-level=high` pass. The live
> registry check still reports pre-existing external drift for Kinara and two
> unrelated shared-app mount paths, so 6.1 remains open until that platform
> state is corrected or explicitly accepted.
