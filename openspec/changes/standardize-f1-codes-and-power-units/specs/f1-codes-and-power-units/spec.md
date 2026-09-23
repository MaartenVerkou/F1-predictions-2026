## Purpose

Provides stable Formula 1 presentation codes and power-unit metadata so season inputs can be reused consistently by questions, race analysis, and future historical seasons.

## ADDED Requirements

### Requirement: Driver nationalities use F1 three-letter codes

The canonical driver nationality field SHALL accept, store, and return either an empty value or exactly three uppercase letters representing the F1 presentation nationality code. Existing two-letter values SHALL be migrated to their known three-letter equivalents without changing driver IDs.

#### Scenario: Seeded nationality is displayed in F1 format
- **WHEN** a driver is seeded with a known nationality
- **THEN** the drivers table and driver editor show the corresponding three-letter uppercase code

#### Scenario: Invalid nationality is rejected
- **WHEN** an administrator submits a nationality that is not empty or exactly three letters
- **THEN** the save is rejected and the driver record is unchanged

### Requirement: Team codes are canonical three-letter identifiers

Every populated team code SHALL be exactly three uppercase letters and SHALL remain independent of the stable team ID and display name.

#### Scenario: Team codes are available for seeded teams
- **WHEN** the 2026 team catalog is seeded
- **THEN** every seeded team has a three-letter code in the canonical team record and table

#### Scenario: Team code editing preserves relationships
- **WHEN** an administrator edits a team code
- **THEN** only the team metadata changes; stable IDs, driver assignments, and team order remain unchanged

### Requirement: Teams expose optional power-unit metadata

The canonical team record SHALL store an optional power-unit name and the admin team table and editor SHALL display and maintain it.

#### Scenario: Power-unit data is visible
- **WHEN** a team has a known power unit
- **THEN** the team table shows the power unit alongside its compact metadata and the editor shows the current value

#### Scenario: Power-unit data is unknown
- **WHEN** a team has no researched power-unit value for a season
- **THEN** the field remains empty and the team remains usable

#### Scenario: Power-unit editing preserves lineup data
- **WHEN** an administrator saves a team's power unit
- **THEN** the team metadata is updated without changing its driver periods or stable identity
