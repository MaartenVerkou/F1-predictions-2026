## MODIFIED Requirements

### Requirement: Admin can review one selected race result in a focused workspace

The system SHALL provide an admin-only Season actuals review workspace with a single race selector and one compact selected-snapshot metadata/action line, with all displayed driver/team values resolved through canonical season inputs.

#### Scenario: Admin selects a pending race

- **GIVEN** an admin selects a race with a pending snapshot
- **WHEN** the Season actuals workspace renders
- **THEN** the workspace SHALL show that race as the selected snapshot
- **AND** it SHALL provide the existing action to mark the selected snapshot reviewed
- **AND** displayed entity values SHALL use canonical IDs resolved to current labels
- **AND** it SHALL not repeat a season-wide pending-count summary

### Requirement: Review workspace shows answer context with interpreted results

The system SHALL show the selected race's relevant question context and interpreted actual values together before review, using canonical entity references for driver and team values.

#### Scenario: Admin validates a selected snapshot

- **GIVEN** an admin has selected a race snapshot
- **WHEN** the review workspace renders
- **THEN** it SHALL show the selected race's interpreted values and corresponding question context
- **AND** entity-valued results SHALL resolve through the canonical season inputs
- **AND** it SHALL provide the existing snapshot save and review actions for that same selected race
