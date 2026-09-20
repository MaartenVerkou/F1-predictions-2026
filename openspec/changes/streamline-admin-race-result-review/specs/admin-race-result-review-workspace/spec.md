## ADDED Requirements

### Requirement: Admin can review one selected race result in a focused workspace
The system SHALL provide an admin-only Season actuals review workspace with a single race selector and one compact selected-snapshot metadata/action line.

#### Scenario: Admin selects a pending race
- **GIVEN** an admin selects a race with a pending snapshot
- **WHEN** the Season actuals workspace renders
- **THEN** the workspace SHALL show that race as the selected snapshot
- **AND** it SHALL provide the existing action to mark the selected snapshot reviewed
- **AND** it SHALL not repeat a season-wide pending-count summary

### Requirement: Review workspace shows answer context with interpreted results
The system SHALL show the selected race's relevant question context and interpreted actual values together before the admin confirms its snapshot.

#### Scenario: Admin validates a selected snapshot
- **GIVEN** an admin has selected a race snapshot
- **WHEN** the review workspace renders
- **THEN** it SHALL show the selected snapshot's interpreted values
- **AND** it SHALL show the corresponding score-bearing question context for that race
- **AND** it SHALL provide the existing snapshot save and review actions for that same selected race
