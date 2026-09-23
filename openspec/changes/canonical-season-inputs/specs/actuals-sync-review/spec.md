## MODIFIED Requirements

### Requirement: Season sync stores round-scored actual snapshots

The system SHALL persist completed rounds as scored historical snapshots derived from canonical race evidence and SHALL use canonical entity references for entity-valued actuals.

#### Scenario: Automatic sync backfills completed rounds

- **GIVEN** official race data exists for one or more completed rounds in the configured season
- **WHEN** an admin runs season sync or the scheduled automatic sync runs
- **THEN** the system SHALL resolve source rows through canonical provider mappings before derivation
- **AND** the system SHALL save a latest snapshot for every completed round
- **AND** the latest synced round SHALL remain pending review until an admin confirms it

### Requirement: Snapshot review state survives unchanged syncs

The system SHALL preserve reviewed metadata when a re-sync produces unchanged canonical values and SHALL create a new pending latest snapshot when the computed canonical values change.

#### Scenario: Unchanged round sync preserves reviewed status

- **GIVEN** a round already has a reviewed latest snapshot
- **AND** a later season sync computes the same canonical values for that round
- **WHEN** the sync finishes
- **THEN** it SHALL keep the reviewed snapshot as the latest snapshot for that round
- **AND** it SHALL preserve the reviewed timestamp and reviewer metadata

#### Scenario: Changed round sync creates a new pending latest snapshot

- **GIVEN** a round already has a reviewed latest snapshot
- **AND** a later season sync computes different canonical values for that round
- **WHEN** the sync finishes
- **THEN** it SHALL create a new latest snapshot for that round
- **AND** the new latest snapshot SHALL be marked pending review
