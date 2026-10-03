## Purpose

Give administrators a durable, easy-to-read way to maintain driver-seat history for every team in a season, including rare mid-season replacements, without presenting a race-by-race editing model.

## ADDED Requirements

### Requirement: Team table shows lineup periods

The admin Inputs team view SHALL show each active season team once, with seat 1 and seat 2 rendered as zero or more chronological assignment periods. Each period SHALL show the canonical driver name and its round range, using an explicit “present” label when no end round exists.

#### Scenario: Stable season lineup

- **GIVEN** a team has George Russell assigned to seat 1 from round 1 through the current season end
- **WHEN** an admin opens the team view
- **THEN** seat 1 SHALL show one compact period for George Russell with `R1–present` or the configured final round
- **AND** the page SHALL not require the admin to select an effective race to understand the assignment

#### Scenario: Mid-season replacement

- **GIVEN** seat 1 has Driver A from round 1 through round 6 and Driver B from round 7 onward
- **WHEN** an admin opens the team view
- **THEN** both periods SHALL be visible in chronological order in the same seat cell
- **AND** the two periods SHALL be visually distinguishable without exposing database IDs

#### Scenario: Empty seat

- **GIVEN** a season team has no assignment for one seat
- **WHEN** the team view renders
- **THEN** that seat SHALL show a clear empty state
- **AND** the admin SHALL be able to add a period for that seat

### Requirement: Team history can be edited as periods

The admin SHALL be able to select a team, enter edit mode, and add, change, or remove period rows for either seat. Each period editor SHALL require a driver from the season driver catalog and a positive start round, and SHALL allow an open-ended end round.

#### Scenario: Add a replacement period

- **GIVEN** a team has an existing seat 2 period ending at round 8
- **WHEN** an admin adds a seat 2 period for Driver B starting at round 9 with no end round and saves
- **THEN** the team view SHALL show the original period as `R1–R8` and the new period as `R9–present`
- **AND** Driver B SHALL be resolved through the canonical driver identity

#### Scenario: Driver choices come from the catalog

- **GIVEN** the season driver catalog contains Driver A and Driver B
- **WHEN** the period editor opens
- **THEN** the driver control SHALL offer those canonical drivers by name
- **AND** manually typed driver names SHALL not create or alter a canonical identity

#### Scenario: Removing a period

- **GIVEN** an admin removes a period from the editor
- **WHEN** the admin saves the team history
- **THEN** that assignment SHALL no longer be effective for any round
- **AND** the UI SHALL require the existing confirmation step before a destructive removal is committed

### Requirement: History save is atomic and interval-safe

The system SHALL validate the complete submitted history for the team before writing it and SHALL commit all changes in one transaction. A seat SHALL not have overlapping periods, a driver SHALL not occupy two teams or seats during the same season interval, and invalid submissions SHALL leave existing history unchanged.

#### Scenario: Valid history save

- **GIVEN** the submitted periods have valid positive bounds and no overlap
- **WHEN** an authorized admin saves the team history
- **THEN** all intended creates, updates, and removals SHALL commit together
- **AND** a subsequent read SHALL return the periods in chronological order

#### Scenario: Overlapping periods rejected

- **GIVEN** two submitted periods for the same seat overlap
- **WHEN** the admin saves
- **THEN** the system SHALL reject the request with a clear validation error
- **AND** no assignment row SHALL be changed

#### Scenario: Duplicate driver occupancy rejected

- **GIVEN** a submitted period places one driver in overlapping seats or teams
- **WHEN** the admin saves
- **THEN** the system SHALL reject the request
- **AND** the existing assignment history SHALL remain intact

### Requirement: Historical corrections are explicit

The system SHALL detect when a team-history change affects a round with imported evidence or reviewed actuals and SHALL require an explicit historical-correction confirmation in the same form submission. A normal future edit SHALL not require that confirmation.

#### Scenario: Future change

- **GIVEN** the earliest changed round is after all imported evidence and reviewed actuals
- **WHEN** the admin saves
- **THEN** the history SHALL save without an additional historical-correction confirmation

#### Scenario: Past change

- **GIVEN** the earliest changed round intersects imported evidence or reviewed actuals
- **WHEN** the admin submits without the confirmation
- **THEN** the system SHALL reject the save and explain that historical data is affected
- **AND** no assignment data SHALL change

### Requirement: Secondary history view remains diagnostic

The Inputs page MAY retain an all-assignment history tab, but it SHALL be read-only in the primary workflow and SHALL not be required for normal driver swaps. The primary team table SHALL not display raw assignment IDs or a race-by-race lineup selector.

#### Scenario: Admin reviews raw history

- **GIVEN** an admin opens the secondary history view
- **WHEN** the data renders
- **THEN** the admin SHALL see the normalized assignment periods for diagnostics
- **AND** the team table remains the canonical place to make lineup changes

