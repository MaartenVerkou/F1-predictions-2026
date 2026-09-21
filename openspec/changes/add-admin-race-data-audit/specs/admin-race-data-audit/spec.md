## Purpose

Provide admins with a read-only season-wide view of persisted race evidence and derived values so they can verify that imported results were interpreted correctly before scoring is trusted.

## ADDED Requirements

### Requirement: Admin can inspect season race evidence in compact matrices

The system SHALL provide an admin-only Race data workspace that exposes the configured season rounds as columns and supports both driver and constructor views.

#### Scenario: Admin opens the driver matrix

- **GIVEN** an authenticated admin opens the Race data workspace
- **WHEN** persisted evidence exists for one or more configured rounds
- **THEN** the workspace SHALL show one row per known driver and one column per configured race
- **AND** each race cell SHALL show the driver's classified result or an explicit status such as Ret, DNS, DNQ, NC, DSQ, or cancelled
- **AND** the workspace SHALL show season points or an equivalent cumulative summary for each driver
- **AND** the wide matrix SHALL scroll inside its table region without causing document-level horizontal overflow

#### Scenario: Admin switches to the constructor matrix

- **GIVEN** an authenticated admin is viewing the Race data workspace
- **WHEN** the admin selects the constructors view
- **THEN** the workspace SHALL show one row per configured constructor and one column per configured race
- **AND** each race cell SHALL show the constructor's points for that race
- **AND** the workspace SHALL show the constructor's cumulative points and championship position when available

#### Scenario: Evidence is unavailable for a round

- **GIVEN** a configured round has no persisted source bundle
- **WHEN** either matrix renders
- **THEN** the affected cells SHALL show an explicit unavailable or not-yet-synced state
- **AND** the workspace SHALL not present missing data as a zero result

### Requirement: Admin can inspect one selected round in detail

The system SHALL allow an admin to select a configured round and inspect the persisted evidence used for that round.

#### Scenario: Admin opens a completed round

- **GIVEN** a selected round has a persisted source bundle
- **WHEN** the round detail renders
- **THEN** it SHALL show each known driver with constructor, grid position, qualifying position when available, sprint result when available, race classification, race status, and points
- **AND** it SHALL show source metadata and coverage state for the selected round
- **AND** it SHALL show the derived actual values associated with that round or link directly to the matching Actuals review target

#### Scenario: Admin opens a cancelled or future round

- **GIVEN** the selected round is cancelled, future, or has no official source result
- **WHEN** the round detail renders
- **THEN** it SHALL show the calendar state and an explicit no-result explanation
- **AND** it SHALL not fabricate driver results or points

### Requirement: Race data audit is linked to scoring review but remains read-only

The system SHALL connect persisted source evidence to the derived actual snapshot without allowing the audit page to mutate scoring state.

#### Scenario: Admin follows derived actuals

- **GIVEN** a selected round has both source evidence and a derived actual snapshot
- **WHEN** the admin chooses the actuals review action
- **THEN** the system SHALL open the existing Actuals review target for that round
- **AND** the audit page SHALL preserve the selected round context

#### Scenario: Admin submits a mutation to the audit route

- **GIVEN** an authenticated admin sends a state-changing request to the Race data audit route
- **WHEN** the request is processed
- **THEN** the system SHALL reject the mutation
- **AND** live actuals, snapshots, and review status SHALL remain unchanged

#### Scenario: Non-admin requests the audit workspace

- **GIVEN** a signed-out user or authenticated non-admin requests the Race data workspace
- **WHEN** the request is processed
- **THEN** the system SHALL enforce the existing admin access policy
