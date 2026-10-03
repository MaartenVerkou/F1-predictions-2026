## MODIFIED Requirements

### Requirement: Admins can review and correct round snapshots
The system SHALL expose pending review status to admins and SHALL allow a protected complete-table correction for an individual round snapshot without overwriting unrelated live scoring targets. The selected snapshot review view SHALL give the admin the relevant question context and interpreted actual values required to validate that round.

#### Scenario: Admin reviews the latest synced round
- **GIVEN** the latest synced round snapshot is pending review
- **WHEN** an admin opens the Season actuals page
- **THEN** the system SHALL show the live scoring source and the latest synced round in the selector
- **AND** the system SHALL allow the admin to select and mark the latest synced round reviewed
- **AND** the selected review view SHALL show the round's question context and interpreted actual values

#### Scenario: Admin edits a selected round snapshot
- **GIVEN** an admin targets a specific race round from the Season actuals selector
- **WHEN** the admin saves a valid protected correction for the complete evidence table
- **THEN** the system SHALL save a new immutable evidence revision for that selected round
- **AND** the system SHALL re-derive actuals from the corrected evidence
- **AND** the derived snapshot SHALL be marked reviewed by the correcting admin and published for that round
- **AND** saving a non-current round target SHALL not overwrite unrelated current-round evidence or scoring targets

#### Scenario: Corrected review identity is preserved
- **GIVEN** a corrected evidence revision was saved successfully
- **WHEN** an admin reopens that round
- **THEN** the review state SHALL identify the editor and edit timestamp as `Edited by …`
- **AND** the original provider revision SHALL remain available in revision history
