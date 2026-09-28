## 1. Session-aware result facts

- [x] 1.1 Add pure helpers and tests for optional practice/sprint-qualifying session discovery and deterministic normal/sprint column order.
- [x] 1.2 Update the race-data review model and route to expose numeric finish positions and per-session row values without changing stored evidence.
- [x] 1.3 Render the dynamic session columns through the existing shared result-table partial and keep detail rows in Grand Prix finish order.

## 2. Responsive identities and controls

- [x] 2.1 Restore full driver and constructor labels as the default and move compact codes behind responsive width breakpoints with title/ARIA discoverability.
- [x] 2.2 Remove the vertical borders inside the result-table identity block while preserving the boundary before numeric session facts.
- [x] 2.3 Unify Drivers/Constructors and content-variant controls with shared segmented styling and add the narrow-layout metric select fallback.

## 3. Verification and preview

- [x] 3.1 Add/adjust focused unit and template tests for positions, session columns, responsive class contracts, and context-preserving variant navigation.
- [x] 3.2 Run focused tests, full tests, strict OpenSpec validation, and Playwright smoke checks for sprint/normal and narrow layouts.
- [x] 3.3 Review the final diff, commit the implementation, and refresh the stable preview without changing production or replacing preview data.
