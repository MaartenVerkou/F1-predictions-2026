## Why

The season input page currently exposes scoring rules alongside every input table, which adds noise when an administrator is maintaining drivers, teams, or races. The race-data review also uses a long label for the cumulative championship-results view and reserves more mobile width than its content needs. A focused scoring section and tighter responsive table presentation will make the workflows easier to scan without changing the underlying scoring or evidence model.

## What Changes

- Add a dedicated **Scoring system** Inputs sub-section alongside Drivers, Teams, and Races; scoring rules are rendered only when that sub-section is selected.
- Rename the cumulative championship-results view to **Results** while retaining an explanatory accessible label/tooltip; keep the per-round derived points view named **Points**.
- Refine the shared race-data table layout for small viewports so identity and final summary columns use content-aware compact widths, while preserving readable full labels when space allows and keeping the existing horizontal scroll behavior.
- Keep scoring-rule data, race evidence, derivations, and calculations unchanged; this is a navigation and presentation improvement.

## Capabilities

### New Capabilities
- `scoring-system-inputs`: A dedicated Inputs sub-section for viewing season scoring rules without displaying them on unrelated input tabs.

### Modified Capabilities
- `admin-interface`: Input navigation and responsive race-data presentation are refined while preserving existing editing and review behavior.
- `admin-race-result-review-workspace`: The cumulative-results metric is presented as Results and the shared table adapts more tightly at mobile widths.

## Impact

The Inputs route and view navigation, race-data metric metadata, shared race-data table styles, and their focused tests are affected. No production data, scoring formulas, provider integrations, or public APIs change.
