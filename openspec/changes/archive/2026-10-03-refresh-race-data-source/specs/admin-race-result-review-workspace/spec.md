## ADDED Requirements

### Requirement: Admin can refresh the selected round from its source

The Race Data review workspace SHALL provide an admin-only `Refresh source` action when a persisted round is selected. The action SHALL require an explicit confirmation and SHALL preserve the current season, round, table view, and focus when it returns.

#### Scenario: Admin confirms a source refresh
- **GIVEN** an admin is viewing a persisted race-data round
- **WHEN** the admin confirms `Refresh source`
- **THEN** the system SHALL fetch that round through the canonical evidence pipeline
- **AND** it SHALL create a new provider evidence revision without deleting prior provider or admin-correction revisions
- **AND** the workspace SHALL return to the same round and show the refreshed revision as pending review

#### Scenario: Admin cancels a source refresh
- **GIVEN** an admin starts the `Refresh source` action
- **WHEN** the admin cancels the confirmation
- **THEN** the system SHALL make no network-backed data mutation
- **AND** the selected table SHALL remain unchanged

#### Scenario: Source refresh is unavailable
- **GIVEN** the selected round has no persisted evidence or the upstream provider cannot return valid evidence
- **WHEN** the admin requests a source refresh
- **THEN** the system SHALL show a concise error
- **AND** it SHALL not create a partial evidence revision
