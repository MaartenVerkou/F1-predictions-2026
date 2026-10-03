## 1. Establish the WOK contract and release baseline

- [ ] 1.1 Update `mhv-app.yaml` and related contract fixtures to use `wok` / Wheel of Knowledge as the canonical identity while recording `f1` as an explicit compatibility alias.
- [ ] 1.2 Add contract tests and documentation assertions that registry slug, preview hostname pattern, repository, production domain, health endpoint, and database backend remain aligned.
- [ ] 1.3 Capture the current admin routes, active OpenSpec changes, worktrees, and untracked files in a reviewable cleanup inventory without deleting user files.

## 2. Build the shared admin presentation layer

- [ ] 2.1 Add semantic admin design tokens for spacing, control height, table density, radius, borders, typography, and light/dark surfaces.
- [ ] 2.2 Add reusable EJS partials/classes for the admin page heading, toolbar/action group, segmented control, bounded table shell, and status/metadata line.
- [ ] 2.3 Add shared focus, disabled, hover, reduced-motion, and compact responsive states for those primitives.
- [ ] 2.4 Add focused rendered-template assertions for the shared primitives and ensure no equivalent inline styles are introduced.

## 3. Migrate admin surfaces in vertical slices

- [ ] 3.1 Migrate Race Data to the shared shell as the reference slice without changing evidence, derivation, or correction behavior.
- [ ] 3.2 Migrate Results and Questions to the same toolbar, segmented control, table shell, and status metadata contract.
- [ ] 3.3 Migrate Season Inputs, Definitions, and scoring tables, preserving selection/edit/reorder behavior and compact phone layout.
- [ ] 3.4 Migrate analysis, user/group detail, and remaining admin tables where the shared contract applies; retain explicit variants for genuinely different data shapes.
- [ ] 3.5 Add representative Playwright coverage for desktop/mobile and light/dark states, including table-local scrolling and keyboard focus.

## 4. Simplify admin code and measure runtime behavior

- [ ] 4.1 Extract clearly bounded admin presentation/review helpers from `src/routes/admin.js` without changing the canonical scoring/evidence APIs.
- [ ] 4.2 Add sampled request-duration and heap observations with sensitive fields excluded from logs.
- [ ] 4.3 Measure repeated derivation work for a season/round/revision and add revision-keyed caching only where the measurement demonstrates a benefit; invalidate on refresh/correction.

## 5. Repository and OpenSpec cleanup

- [ ] 5.1 Classify active OpenSpec changes as active, completed, superseded, or historical and archive only verified completed/superseded changes using the approved workflow.
- [ ] 5.2 Remove verified disposable probe files and archive unused managed worktrees without touching user-owned changes, secrets, production state, or database backups.
- [ ] 5.3 Run strict OpenSpec validation and review the final diff for duplicated CSS, dead classes, accidental data changes, and unrelated edits.

## 6. Release verification

- [ ] 6.1 Run lint, unit tests, build, Playwright, dependency/security checks, and live MHV registry validation.
- [ ] 6.2 Refresh the Apps Hub preview from the immutable image, verify `/healthz`, and inspect the migrated admin pages before production.
- [ ] 6.3 After explicit preview approval, merge the latest main, deploy the approved immutable GHCR digest, verify production health/database backend, and retain the rollback image.
