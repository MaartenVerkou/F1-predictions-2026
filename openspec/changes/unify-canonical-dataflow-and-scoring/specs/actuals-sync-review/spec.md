## MODIFIED Requirements

### Requirement: Season sync stores round-scoped, reviewable actual snapshots
The system SHALL persist completed or explicitly reconstructed rounds as season-scoped actual snapshots derived from persisted evidence and the canonical season catalog. A reviewed/published actual set for one season SHALL drive scoring for that season only; another season's snapshots SHALL never become live by fallback.

Feature: Actual sync review

Rule: Completed rounds SHALL be persisted as versioned history and only the latest reviewed/published set for the selected season SHALL drive that season's scoring.

#### Scenario: Automatic sync backfills completed rounds
- **GIVEN** official or explicitly reconstructed evidence exists for one or more completed rounds in a configured season
- **WHEN** an admin runs season sync or the scheduled automatic sync runs
- **THEN** the system SHALL save a latest snapshot for every eligible completed round
- **AND** each snapshot SHALL retain its season, round, evidence revision, catalog revision, and derivation version
- **AND** the resulting snapshot SHALL remain pending review until an admin confirms it

#### Scenario: A reviewed snapshot is selected for scoring
- **GIVEN** a season has one or more reviewed snapshots
- **WHEN** a participant is scored for that season
- **THEN** scoring SHALL use the latest published reviewed actual set for that season
- **AND** it SHALL not read an unreviewed snapshot or another season's actuals

#### Scenario: A season has no publishable snapshot
- **GIVEN** a season has no reviewed actual snapshot
- **WHEN** scoring or the public result view is requested
- **THEN** the system SHALL show that actuals are not yet available
- **AND** it SHALL not score from transient provider data or guessed values

### Requirement: Snapshot provenance survives corrections
Every actual snapshot SHALL preserve the evidence revision, catalog revision, derivation version, review state, reviewer metadata, and any explicit manual correction. Re-syncing unchanged derived values SHALL preserve review metadata; changed values SHALL create a new pending revision.

#### Scenario: An unchanged round is re-synced
- **GIVEN** a round has a reviewed snapshot
- **WHEN** a later sync produces identical values and provenance inputs
- **THEN** the reviewed snapshot and reviewer metadata SHALL remain current

#### Scenario: A reviewed round is corrected
- **GIVEN** an administrator changes a selected round's actual value
- **WHEN** the correction is saved
- **THEN** the system SHALL create an auditable correction linked to the prior snapshot
- **AND** it SHALL require review before becoming the season's published actual set

### Requirement: Actuals overview uses one bounded answer presentation
The season Actuals overview SHALL use one shared presentation policy for multi-entity answers across all questions. It SHALL deduplicate repeated entities, prefer compact three-character entity codes, group visible codes into at most two lines, and expose an overflow count when more entities exist. The complete canonical answer SHALL remain available through the cell's accessible label or title.

#### Scenario: A question returns a long driver or constructor list
- **WHEN** an Actuals cell contains more than six unique driver or constructor values
- **THEN** the visible cell SHALL remain within two compact code lines with an overflow count
- **AND** the full answer SHALL remain available to assistive technology and hover inspection
- **AND** the row height SHALL not depend on the number of returned entities

#### Scenario: A future question returns a short entity list
- **WHEN** a new question returns three or more unique entities through the shared overview model
- **THEN** the same compact projection SHALL apply without adding question-specific formatting code
