## Context

Wheel of Knowledge is a server-rendered Express/EJS application with a shared stylesheet and several admin workspaces. Race Data is the strongest current reference: it has a compact page header, explicit toolbar, segmented view controls, bounded table scrolling, neutral audit surfaces, and consistent light/dark behavior. Other admin pages have accumulated their own widths, paddings, borders, and button variants, so visually similar controls drift apart.

The repository also contains a large admin route module and many historical OpenSpec change folders. Production is already deployed through GitHub Actions and immutable GHCR images, so this change must preserve the existing database, release, preview, and rollback contract.

## Goals / Non-Goals

**Goals:**

- Establish a small set of shared admin tokens and primitives that use Race Data as the visual reference.
- Migrate the most frequently used admin pages without changing their domain behavior or URLs.
- Make tables, toolbars, segmented controls, status states, and responsive behavior predictable across light and dark themes.
- Add regression checks for the shared presentation contract.
- Make `wok` the canonical platform identity while retaining existing domains, server paths, database names, and rollback metadata.
- Clean up completed/superseded planning artifacts and disposable local files only after explicit verification.
- Add low-cost timing and heap observations so later performance work is evidence-led.

**Non-Goals:**

- Do not replace EJS/Express with a frontend framework.
- Do not redesign public prediction flows in this change.
- Do not alter race evidence, scoring formulas, actuals values, or database records.
- Do not migrate `/srv/f1-predictions` to `/srv/apps/wok` yet; that remains a separate compatibility migration.
- Do not delete local user files or OpenSpec changes solely because they look old.

## Decisions

### 1. Use a small token layer, not a new styling framework

Add semantic admin tokens for spacing, control height, border/radius, table density, and surface colors under the existing theme roots. Shared classes compose these tokens. A CSS framework or Tailwind migration would add churn without solving the current duplicated markup and page-specific rules.

### 2. Treat Race Data as the reference implementation

Keep the existing Race Data structure and migrate other pages toward it: page heading, selector stack, toolbar, segmented controls, bounded scroll region, compact table, and metadata/legend surfaces. Domain-specific matrix and leaderboard variants remain allowed, but they inherit the same shell and control geometry.

### 3. Add reusable EJS partials at stable layout boundaries

Create partials for the admin page heading, action toolbar, segmented control group, table scroll shell, and status/metadata line. Partials accept labels, links, active state, and capabilities rather than embedding page-specific behavior. Existing route handlers continue to provide domain data.

### 4. Migrate in vertical slices

Migrate Race Data first as a no-op baseline, then Results/Questions, Season Inputs/Definitions, and finally analysis/leaderboard admin surfaces. Each slice includes a rendered-view assertion and a Playwright check before the next slice. This keeps the change reversible and prevents a stylesheet rewrite from masking regressions.

### 5. Separate derivation from transport while preserving behavior

Move only clearly bounded admin route helpers into domain modules (presentation model, review metadata, and instrumentation). Do not rewrite scoring or evidence derivation. Add a revision-keyed request cache only if focused measurements show repeated work in the same request path; cache invalidation follows evidence correction/refresh.

### 6. Normalize platform identity without moving infrastructure

Update `mhv-app.yaml`, registry documentation, and validation fixtures so the canonical display/app identity is `wok`/Wheel of Knowledge. Keep compatibility aliases (`f1`, current production path, existing domains) explicit until a separately approved path migration is completed.

### 7. Treat cleanup as an audited release task

Classify OpenSpec folders as active, completed, superseded, or historical. Archive only completed changes after their implementation commits are on main and validation passes. Remove temporary probe files/worktrees only when ownership and recoverability are known.

### 8. Use explicit WOK runtime names with a compatibility window

The production application container will be named `wheelofknowledge` and expose
that name on `mhv-web`; the stable user-testing runtime will be named
`preview-wok`. The existing `f1-app` network alias remains temporarily so the
currently deployed Caddy route and rollback image can continue to work until the
preview is approved and production is redeployed. The registry and deploy
script use the canonical names first and only fall back to the legacy production
container while the transition is incomplete.

## Risks / Trade-offs

- **Shared styles accidentally change a page-specific table** → migrate one page at a time, retain variant classes, and run desktop/mobile light/dark browser checks.
- **Partials hide useful page differences** → keep the partial API small and pass data/capabilities explicitly; do not make partials responsible for derivation.
- **Identity normalization breaks deployment tooling** → update registry/contract tests first and preserve compatibility aliases and current paths.
- **Instrumentation adds log volume** → sample slow requests and report aggregate timing fields without query parameters, tokens, or personal data.
- **Cleanup removes user work** → no destructive cleanup without a verified status/owner check and a recoverable commit or archive.

## Migration Plan

1. Commit the proposal, design, and specs separately from implementation.
2. Add tokens/partials and migrate the Race Data shell without changing behavior.
3. Migrate Results/Questions, then Inputs/Definitions, then remaining admin tables; add focused tests after each slice.
4. Add identity normalization and registry/contract validation; do not move production paths.
5. Add lightweight timing/heap diagnostics and capture a baseline under the existing production workload.
6. Run lint, unit tests, build, Playwright, OpenSpec validation, and live registry checks.
7. Refresh the Apps Hub preview from an immutable image and wait for user approval before production deployment.
8. After approval, merge/rebase on latest main, deploy the approved digest, verify `/healthz`, then archive completed changes.

Rollback is a deployment to the retained prior immutable image. UI changes are code-only; no database rollback is required.

## Open Questions

- Which remaining admin page should be migrated after Inputs: Analysis or the user/group administration pages?
- Should the visual system eventually cover the public leaderboard and prediction forms, or remain admin-only?
- After the cleanup inventory, which old OpenSpec changes are intentionally kept as historical context rather than archived?
