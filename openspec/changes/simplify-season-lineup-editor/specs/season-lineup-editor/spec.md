## Purpose

Provide an admin workflow that edits the season's driver lineup by effective round without requiring admins to manipulate interval records or understand database identity details.

## ADDED Requirements

### Requirement: Admin can edit a round-specific team lineup

The system SHALL present a team-centric lineup for a selected season and effective round, with one editable Driver 1 and Driver 2 value per team.

#### Scenario: Admin opens the lineup

- **GIVEN** an authenticated admin opens the season lineup for a configured season
- **WHEN** the admin selects round N
- **THEN** each active team SHALL appear once in the configured season order
- **AND** each team SHALL show the drivers assigned to its two seats at round N
- **AND** the primary controls SHALL be driver choices and one lineup save action, not raw assignment IDs or interval fields

#### Scenario: Empty seat is visible

- **GIVEN** a team has no driver assigned to one seat at round N
- **WHEN** the lineup renders
- **THEN** that seat SHALL show an explicit empty value
- **AND** the admin SHALL be able to fill it without editing a database identifier

### Requirement: Lineup changes create round-bounded history atomically

The system SHALL apply one submitted lineup change as one protected transaction that preserves prior assignments and creates the new effective assignments.

#### Scenario: Driver replacement from a future round

- **GIVEN** Driver A occupies Team X seat 2 through round N-1
- **WHEN** an admin selects Driver B for Team X seat 2 at round N and saves the lineup
- **THEN** Driver A's assignment SHALL end at round N-1
- **AND** Driver B's assignment SHALL begin at round N
- **AND** views for rounds before N SHALL still show Driver A
- **AND** views for round N and later SHALL show Driver B

#### Scenario: Two drivers swap seats or teams

- **GIVEN** an admin changes two or more seats in the same lineup submission
- **WHEN** the lineup is saved
- **THEN** all changes SHALL be validated against the final desired lineup before any write is committed
- **AND** either every valid seat change SHALL be committed or none SHALL be committed
- **AND** no transient overlap SHALL make a valid swap fail

#### Scenario: Invalid duplicate occupancy

- **GIVEN** the desired lineup assigns one driver to two active seats or two drivers to the same team seat
- **WHEN** the admin submits the lineup
- **THEN** the system SHALL reject the submission with a clear error
- **AND** no assignment history SHALL be changed

### Requirement: New replacement drivers can be added safely

The system SHALL provide an advanced, admin-only path to create a canonical driver and add the driver to the season before using the driver in a lineup.

#### Scenario: Admin adds an unlisted replacement

- **GIVEN** a replacement driver does not exist in the canonical catalog
- **WHEN** an admin adds the driver's identity and season membership
- **THEN** the driver SHALL become selectable in the lineup editor
- **AND** the driver SHALL receive one immutable canonical identity
- **AND** an optional provider reference or alias SHALL be attachable without changing the identity

#### Scenario: Non-admin attempts lineup mutation

- **GIVEN** a signed-out user or authenticated non-admin submits a lineup or driver mutation
- **WHEN** the request is processed
- **THEN** the existing admin authorization and form-action protection SHALL reject it
- **AND** no lineup data SHALL change

### Requirement: Downstream round resolution preserves historical source data

The system SHALL use the effective canonical lineup when resolving round-specific driver/team context while retaining imported race-result provenance unchanged.

#### Scenario: Historical source evidence remains stable

- **GIVEN** a race-data snapshot records the provider's observed driver and team for round N
- **WHEN** an admin changes the lineup beginning at round M after the snapshot exists
- **THEN** the stored source labels and observed team identity for round N SHALL remain unchanged
- **AND** derived views for rounds at or after M SHALL use the new effective lineup where a lineup relationship is required

#### Scenario: Actuals and questions use the selected round

- **GIVEN** an admin views race data, questions, or actuals for round N
- **WHEN** the page resolves driver/team options or relationships
- **THEN** it SHALL use the canonical lineup effective at round N
- **AND** changing a display name SHALL not break existing canonical references
