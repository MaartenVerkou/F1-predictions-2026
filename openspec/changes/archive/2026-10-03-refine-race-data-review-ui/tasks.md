## 1. Header and primary facts

- [x] 1.1 Align Season and Round as a compact stacked label/value header and remove the redundant divider/title gap before the primary table.
- [x] 1.2 Add a shared stable race-result column registry and render finish-order evidence in review order with fixed unavailable cells.

## 2. Protected row editing

- [x] 2.1 Replace repeated per-row edit forms with selectable result rows, a compact toolbar Edit action, and one protected editor shell.
- [x] 2.2 Preserve stale-snapshot, canonical-identity, CSRF, confirmation, reason, and audit behavior through the existing correction route.

## 3. Shared metric controls and responsive behavior

- [x] 3.1 Refine Drivers/Constructors and metric controls so both primary tables and derivation review use the shared aligned control pattern without full-page reloads.
- [x] 3.2 Ensure metric switching preserves Season/Round and uses the same row/cell/footer components for driver and constructor views.
- [x] 3.3 Add or update responsive and accessibility states for stacked selectors, selected rows, disabled toolbar actions, and horizontal evidence scrolling.

## 4. Verification and cleanup

- [x] 4.1 Add unit/template/browser coverage for header alignment state, finish-order column order, row selection/edit flow, metric switching, and derivation isolation.
- [x] 4.2 Run focused/full tests, strict OpenSpec validation, preview rebuild, and browser smoke checks without resetting preview PostgreSQL.
- [x] 4.3 Remove obsolete markup/styles exposed by the new single-editor and stable-column paths, then review the final diff and commit the change.
