# actuals-sync-review Specification

## Purpose
Define how completed race actuals become live scoring and reviewable round snapshots.
## Requirements
### Requirement: Season sync stores round-scored actual snapshots
The system SHALL persist completed rounds as scored historical snapshots and SHALL use the latest completed round snapshot to drive live actuals.

Feature: Actual sync review

Rule: Completed rounds SHALL be persisted as scored history and the latest completed round SHALL drive live scoring.

#### Scenario: Automatic sync backfills completed rounds
- **GIVEN** official race data exists for one or more completed rounds in the configured season
- **WHEN** an admin runs season sync or the scheduled automatic sync runs
- **THEN** the system SHALL save a latest snapshot for every completed round
- **AND** the system SHALL replace live actuals with the latest completed round values
- **AND** the latest synced round SHALL remain pending review until an admin confirms it

### Requirement: Snapshot review state survives unchanged syncs
The system SHALL preserve reviewed metadata when a re-sync produces unchanged round values and SHALL create a new pending latest snapshot when the computed values change.

Feature: Actual sync review

Rule: Re-running the same round data SHALL preserve reviewed history, while changed round data SHALL create a new pending latest snapshot.

#### Scenario: Unchanged round sync preserves reviewed status
- **GIVEN** a round already has a reviewed latest snapshot
- **AND** a later season sync computes the same values for that round
- **WHEN** the sync finishes
- **THEN** the system SHALL keep the reviewed snapshot as the latest snapshot for that round
- **AND** the system SHALL preserve the reviewed timestamp and reviewer metadata

#### Scenario: Changed round sync creates a new pending latest snapshot
- **GIVEN** a round already has a reviewed latest snapshot
- **AND** a later season sync computes different values for that round
- **WHEN** the sync finishes
- **THEN** the system SHALL create a new latest snapshot for that round
- **AND** the new latest snapshot SHALL be marked pending review

### Requirement: Admins can review and correct round snapshots
The system SHALL expose pending review status to admins and SHALL allow reviewed corrections for individual round snapshots without overwriting unrelated live scoring targets.

Feature: Actual sync review

Rule: Admin actuals controls SHALL expose the latest review backlog and SHALL allow reviewed corrections without overwriting unrelated scoring targets.

#### Scenario: Admin reviews the latest synced round
- **GIVEN** the latest synced round snapshot is pending review
- **WHEN** an admin opens the Season actuals page
- **THEN** the system SHALL show the pending review backlog and the live scoring source
- **AND** the system SHALL allow the admin to mark the latest synced round reviewed

#### Scenario: Admin edits a selected round snapshot
- **GIVEN** an admin targets a specific race round from the Season actuals selector
- **WHEN** the admin saves actuals for that selected round
- **THEN** the system SHALL save or update a snapshot for that selected round
- **AND** the saved snapshot SHALL be marked reviewed
- **AND** saving a non-current round target SHALL not overwrite current live actuals

### Requirement: Cancelled races do not block historical backfill
The system SHALL keep cancelled races in season ordering and SHALL continue round-history backfill when those races have no official result rows.

Feature: Actual sync review

Rule: Race-derived actuals SHALL tolerate cancelled season rounds so later completed rounds can still be scored.

#### Scenario: Cancelled races stay in season history with zero result-derived values
- **GIVEN** the configured race calendar includes cancelled rounds with no official race result
- **WHEN** season sync computes round-based actuals and snapshot history
- **THEN** the system SHALL keep those cancelled rounds in season ordering
- **AND** the system SHALL record zero race-result-derived values for those cancelled rounds where applicable
- **AND** the system SHALL continue syncing later completed rounds
