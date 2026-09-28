## 1. Inputs scoring navigation

- [ ] 1.1 Add the season-scoped Scoring system Inputs tab to route validation and navigation.
- [ ] 1.2 Render the existing scoring-rule overview only for the Scoring system tab, with a clear empty state for seasons without rules.
- [ ] 1.3 Add focused route/template tests proving scoring rules are hidden on Drivers, Teams, and Races and visible on the scoring tab.

## 2. Race-data presentation

- [ ] 2.1 Rename the cumulative `points` metric label to Results and preserve its stable key, links, derivation behavior, and accessible explanatory text.
- [ ] 2.2 Add or update focused model/template tests for Results versus the derived Points metric.
- [ ] 2.3 Refine shared race-data responsive styles so identity and final summary columns tighten by content at phone widths without page overflow or per-focus hacks.

## 3. Verification and preview

- [ ] 3.1 Run focused tests, full tests, and strict OpenSpec validation.
- [ ] 3.2 Rebuild the isolated preview and verify desktop and phone-width Inputs and Race Data flows, including tab visibility, Results label, and compact table behavior.
- [ ] 3.3 Review the final diff for duplicated styles, unintended data changes, and production-impacting changes; record the verified preview URL.
