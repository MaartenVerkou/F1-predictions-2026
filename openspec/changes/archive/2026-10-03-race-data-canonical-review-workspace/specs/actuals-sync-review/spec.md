## MODIFIED Requirements

### Requirement: Season sync stores round-scored actual snapshots

The system SHALL persist completed-round evidence and derive season-scoped actual snapshots from that evidence and the canonical season catalog. A reviewed/published actual set for one season SHALL drive live actuals and scoring for that season only; no global actuals projection or transient provider response may become the source of truth.

Feature: Actual sync review

Rule: Completed rounds SHALL be persisted as evidence, derived deterministically, and published only after review.

#### Scenario: Automatic sync backfills completed rounds
- **GIVEN** official or explicitly reconstructed evidence exists for one or more completed rounds in the configured season
- **WHEN** an admin runs season sync or the scheduled automatic sync runs
- **THEN** the system SHALL persist the evidence and derive a latest snapshot for every eligible completed round
- **AND** each snapshot SHALL retain its evidence, catalog, and derivation revisions
- **AND** the resulting snapshot SHALL remain pending review until an admin confirms it

### Requirement: Snapshot review state survives unchanged syncs

The system SHALL preserve reviewed metadata when a re-sync produces unchanged evidence and derived values, and SHALL create a new pending revision when evidence or derived values change.

Feature: Actual sync review

Rule: Re-running equivalent evidence SHALL preserve review history; a changed evidence revision SHALL require review again.

#### Scenario: Unchanged round sync preserves reviewed status
- **GIVEN** a round already has a reviewed published snapshot
- **AND** a later season sync produces identical evidence and derived values
- **WHEN** the sync finishes
- **THEN** the system SHALL keep the reviewed snapshot and reviewer metadata
- **AND** it SHALL not create a duplicate pending result

#### Scenario: Changed round sync creates a new pending latest snapshot
- **GIVEN** a round already has a reviewed published snapshot
- **AND** a later correction or provider revision changes the evidence or derived value
- **WHEN** the sync finishes
- **THEN** the system SHALL create a new revision for that round
- **AND** the new revision SHALL be marked pending review
- **AND** the previously published result SHALL remain active until review

### Requirement: Admins can review and correct round snapshots

The system SHALL expose pending derivation state to admins and SHALL allow protected corrections to the underlying round evidence with explicit confirmation and audit metadata. Corrections SHALL create a new evidence and derivation revision rather than overwriting unrelated live scoring targets.

Feature: Actual sync review

Rule: Corrections affect scoring only after the resulting derivation is reviewed and published.

#### Scenario: Admin reviews the latest synced round
- **GIVEN** the latest synced round snapshot is pending review
- **WHEN** an admin opens the Actuals overview or linked Race Data derivation review
- **THEN** the system SHALL show the derived values and their evidence/provenance
- **AND** it SHALL allow the admin to mark the result reviewed and publish it

#### Scenario: Admin edits a selected round snapshot
- **GIVEN** an admin targets a specific race round from the protected correction action
- **WHEN** the admin confirms a correction with a reason
- **THEN** the system SHALL create a new evidence revision and derived snapshot for that round
- **AND** the saved revision SHALL remain pending until reviewed
- **AND** saving a non-current round target SHALL not overwrite current live actuals
