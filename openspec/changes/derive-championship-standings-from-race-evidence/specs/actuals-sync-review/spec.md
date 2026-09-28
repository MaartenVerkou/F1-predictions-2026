## MODIFIED Requirements

### Requirement: Season sync stores round-scored actual snapshots
The system SHALL persist completed rounds as scored historical snapshots derived from canonical persisted race evidence and SHALL use the latest reviewed/published snapshot to drive live actuals. A standings provider SHALL NOT be required for sync.

Feature: Actual sync review

Rule: Completed rounds SHALL be persisted as scored history from canonical race evidence and the latest reviewed/published round SHALL drive live scoring.

#### Scenario: Automatic sync backfills completed rounds from race evidence
- **GIVEN** official race and sprint result evidence exists for one or more completed rounds in the configured season
- **WHEN** an admin runs season sync or the scheduled automatic sync runs
- **THEN** the system SHALL save a latest snapshot for every completed round
- **AND** the system SHALL derive championship-dependent answers from the configured season scoring rules
- **AND** the latest synced round SHALL remain pending review until an admin confirms it

### Requirement: Admins can review and correct round snapshots
The system SHALL expose pending review status to admins and SHALL allow reviewed corrections for individual round snapshots without overwriting unrelated live scoring targets. The selected snapshot review view SHALL give the admin the relevant question context and interpreted actual values required to validate that round.

Feature: Actual sync review

Rule: Admin actuals controls SHALL allow reviewed corrections for selected snapshots without overwriting unrelated scoring targets.

#### Scenario: Admin reviews the latest synced round
- **GIVEN** the latest synced round snapshot is pending review
- **WHEN** an admin opens the Season actuals page
- **THEN** the system SHALL show the live scoring source and the latest synced round in the selector
- **AND** it SHALL allow the admin to select and mark the latest synced round reviewed
- **AND** the selected review view SHALL show the round's question context and interpreted actual values

#### Scenario: Admin edits a selected round snapshot
- **GIVEN** an admin targets a specific race round from the Season actuals selector
- **WHEN** the admin saves actuals for that selected round
- **THEN** the system SHALL save or update a snapshot for that selected round
- **AND** the saved snapshot SHALL be marked reviewed
- **AND** saving a non-current round target SHALL not overwrite current live actuals
