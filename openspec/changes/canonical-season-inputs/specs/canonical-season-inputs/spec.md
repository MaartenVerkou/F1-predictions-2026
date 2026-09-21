## Purpose

Provide one identity-safe source of truth for season drivers, teams, races, assignments, and provider mappings so every downstream question, evidence bundle, actual, and score refers to the same canonical entities.

## ADDED Requirements

### Requirement: Canonical season inputs have stable identities

The system SHALL represent drivers, teams, races, and season membership with stable immutable IDs, current display labels, and season context.

#### Scenario: Admin opens season inputs

- **GIVEN** an authenticated admin opens Inputs for a configured season
- **WHEN** the Drivers, Teams, and Races tabs render
- **THEN** each row SHALL expose its stable ID, current label, active state, and season membership
- **AND** the page SHALL show the configured driver/team/race counts

### Requirement: Driver/team assignments are round-aware

The system SHALL represent which team a driver belongs to for each effective round range in a season.

#### Scenario: Driver changes team during a season

- **GIVEN** a driver has a team assignment ending before round N
- **WHEN** an admin creates a replacement assignment beginning at round N
- **THEN** results through round N-1 SHALL retain the previous team ID
- **AND** results from round N onward SHALL resolve to the new assignment
- **AND** overlapping assignments SHALL be rejected

### Requirement: Provider names resolve through explicit mappings

The system SHALL store provider identifiers and aliases for canonical entities and SHALL expose unresolved or conflicting mappings.

#### Scenario: Imported provider row has a known identity

- **GIVEN** an imported provider row contains a configured provider ID or approved alias
- **WHEN** the row is normalized
- **THEN** it SHALL receive the matching canonical entity ID
- **AND** the original provider label SHALL remain available as source provenance

#### Scenario: Imported provider row is ambiguous

- **GIVEN** a provider row cannot be resolved uniquely
- **WHEN** the import is normalized
- **THEN** the row SHALL be marked unresolved/incomplete
- **AND** the system SHALL not silently assign a different driver or team

### Requirement: Inputs is the upstream admin workspace

The system SHALL expose Inputs before Questions in admin navigation with focused tabs for drivers, teams, assignments, races, and mappings.

#### Scenario: Admin edits a canonical label

- **GIVEN** an admin edits a driver or team display label with a valid protected form action
- **WHEN** the change is saved
- **THEN** the immutable ID SHALL remain unchanged
- **AND** Questions, Race data, Actuals, and scoring views SHALL display the updated label

#### Scenario: Non-admin mutates Inputs

- **GIVEN** a signed-out user or authenticated non-admin submits an Inputs mutation
- **WHEN** the request is processed
- **THEN** the existing admin access and form-action protection SHALL reject it

### Requirement: Canonical references flow through questions, evidence, and scoring

The system SHALL write new entity-valued answers, normalized source rows, actual values, and score comparisons using canonical IDs rather than display labels.

#### Scenario: Question option labels change

- **GIVEN** a question option resolves to a canonical driver or team ID
- **WHEN** the entity display label is changed
- **THEN** existing responses and actuals SHALL continue to match the same entity
- **AND** rendered options SHALL show the new label

#### Scenario: Race evidence is inspected

- **GIVEN** a persisted race result contains driver and team IDs
- **WHEN** Race data renders a selected round
- **THEN** the driver and team SHALL be shown from the canonical season inputs
- **AND** the source label SHALL remain available for audit provenance

### Requirement: Season lineups have explicit order and seat occupancy
Feature: Team-centric season lineup

Rule: The system SHALL keep database identity separate from presentation order and driver seat assignment.

#### Scenario: Admin opens the team lineup
- **GIVEN** an authenticated admin opens Inputs for a configured season
- **WHEN** the team lineup renders
- **THEN** teams SHALL be ordered by the season's explicit display order
- **AND** each team SHALL show seat 1 and seat 2 for the selected effective round
- **AND** the displayed order SHALL NOT be derived from database IDs

#### Scenario: A driver changes into a team seat
- **GIVEN** a driver assignment ends before round N
- **AND** a replacement assignment for the same team seat starts at round N
- **WHEN** the admin views the lineup for rounds before and from N
- **THEN** the earlier round SHALL show the original driver
- **AND** round N onward SHALL show the replacement driver
- **AND** overlapping occupancy of one team seat SHALL be rejected

#### Scenario: A new season receives a new team order
- **GIVEN** a new season has the same canonical teams or an additional team
- **WHEN** an admin sets its season display order
- **THEN** existing team IDs SHALL remain unchanged
- **AND** the order SHALL be stored only for that season
