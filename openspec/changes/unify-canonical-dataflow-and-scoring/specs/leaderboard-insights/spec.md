## ADDED Requirements

### Requirement: Scoring uses one canonical, season-scoped actual set
All leaderboard, analysis, and scoring views SHALL use the same shared scoring service, canonical answer references, and published actual set for the selected season and snapshot cutoff.

#### Scenario: A driver is renamed after answers are submitted
- **WHEN** a user opens scoring after the canonical label changes
- **THEN** the submitted canonical reference SHALL still score against the same driver
- **AND** the new display label SHALL be used in the explanation

#### Scenario: A historical snapshot is selected
- **WHEN** a user selects a saved round snapshot
- **THEN** all scoring breakdowns and leaderboard totals SHALL use that snapshot's actual set
- **AND** they SHALL use the same round cutoff as Race data and Actuals

#### Scenario: No reviewed actuals are published
- **WHEN** scoring is requested for a season without a reviewed actual set
- **THEN** the system SHALL show an unavailable state
- **AND** it SHALL not mix current, legacy, or another season's actual values into the result

### Requirement: Scoring outcomes are reproducible
The scoring result SHALL be reproducible from the participant response, question definition/version, canonical catalog revision, and published actual snapshot used at the time of scoring.

#### Scenario: A later Inputs edit changes a lineup
- **WHEN** an old snapshot is recalculated or inspected
- **THEN** it SHALL use the catalog and actual revisions recorded on that snapshot
- **AND** it SHALL not retroactively reinterpret the historical result using the current lineup
