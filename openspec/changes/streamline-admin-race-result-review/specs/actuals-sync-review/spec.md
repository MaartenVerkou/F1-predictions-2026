## MODIFIED Requirements

### Requirement: Admins can review and correct round snapshots
The system SHALL expose pending review status to admins and SHALL allow reviewed corrections for individual round snapshots without overwriting unrelated live scoring targets. The selected snapshot review view SHALL give the admin the relevant question context and interpreted actual values required to validate that round.

Feature: Actual sync review

Rule: Admin actuals controls SHALL expose the latest review backlog and SHALL allow reviewed corrections without overwriting unrelated scoring targets.

#### Scenario: Admin reviews the latest synced round
- **GIVEN** the latest synced round snapshot is pending review
- **WHEN** an admin opens the Season actuals page
- **THEN** the system SHALL show the pending review backlog and the live scoring source
- **AND** the system SHALL allow the admin to select and mark the latest synced round reviewed
- **AND** the selected review view SHALL show the round's question context and interpreted actual values

#### Scenario: Admin edits a selected round snapshot
- **GIVEN** an admin targets a specific race round from the Season actuals selector
- **WHEN** the admin saves actuals for that selected round
- **THEN** the system SHALL save or update a snapshot for that selected round
- **AND** the saved snapshot SHALL be marked reviewed
- **AND** saving a non-current round target SHALL not overwrite current live actuals
