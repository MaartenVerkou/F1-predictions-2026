## Why

Wheel of Knowledge is functional and production-ready, but its admin surfaces have accumulated page-specific table, toolbar, button, and spacing rules. The result is a visually inconsistent, increasingly hard-to-maintain frontend, while the repository still contains overlapping OpenSpec work and mixed `f1`/`wok` platform identity. This change establishes a shared visual contract and a clean operational source of truth before more feature work is added.

## What Changes

- Introduce a small shared admin design system derived from the Race Data page: common page headers, toolbars, segmented controls, buttons, table shells, status indicators, spacing, typography, borders, and theme tokens.
- Migrate the highest-use admin surfaces to the shared primitives, starting with Race Data as the reference and then Results, Questions, Inputs, and the leaderboard-facing admin views.
- Preserve each table's domain-specific behavior while removing duplicated or conflicting page-specific styling and keeping responsive, light/dark, keyboard, and empty/error states consistent.
- Add focused rendered-view and Playwright coverage for the shared controls and representative tables at desktop/mobile and light/dark themes.
- Split oversized admin route/derivation responsibilities where a clear domain boundary exists, without changing the canonical evidence or scoring contract.
- Normalize the platform identity to `wok` in app metadata and registry-facing configuration while keeping existing production paths, domains, databases, and rollback behavior unchanged.
- Audit active OpenSpec changes and local artifacts; archive completed or superseded changes and remove only verified disposable files in a separate cleanup step.
- Add lightweight measurement for request duration, heap usage, and expensive derivation paths before making performance changes; do not optimize memory blindly.

## Capabilities

### New Capabilities

- `admin-design-system`: Shared, accessible, theme-aware admin UI primitives and layout tokens used by all migrated admin surfaces.

### Modified Capabilities

- `admin-interface`: Admin tables and toolbars use a consistent visual and responsive contract while retaining their existing workflows.
- `mhv-app-platform`: Wheel of Knowledge uses one `wok` app identity across app metadata, registry validation, previews, and deployment documentation.

## Impact

- Affected frontend styles, EJS partials, admin templates, and browser tests.
- Affected admin route organization and derivation observability, with no intended public API or data-model change.
- Affected `mhv-app.yaml`, the MHV app registry, deployment/preflight documentation, and registry validation tests.
- No destructive database migration, data rewrite, domain change, or dependency/framework replacement is required.
