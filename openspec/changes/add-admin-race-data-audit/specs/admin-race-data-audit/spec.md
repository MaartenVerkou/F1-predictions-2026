## Purpose

Provide admins with a read-only season-wide view of persisted race evidence and derived values so they can verify that imported results were interpreted correctly before scoring is trusted.

## ADDED Requirements

### Requirement: Admin can inspect season race evidence at a round cutoff

The system SHALL provide an admin-only Race data workspace that exposes configured season rounds as columns and supports both driver and constructor views.

#### Scenario: Admin opens the driver matrix

- **GIVEN** an authenticated admin opens the Race data workspace with a selected cutoff round
- **WHEN** persisted evidence exists for one or more configured rounds
- **THEN** the workspace SHALL show one row per known driver and one column per configured race
- **AND** each race cell through the cutoff SHALL show the classified result or an explicit status such as Ret, DNS, DNQ, NC, DSQ, or cancelled
- **AND** rounds after the cutoff SHALL be visually muted as future
- **AND** the workspace SHALL show cumulative points and championship position from the selected cutoff bundle when available
- **AND** the wide matrix SHALL scroll inside its table region without causing document-level horizontal overflow

#### Scenario: Admin switches to the constructor matrix

- **GIVEN** an authenticated admin is viewing the Race data workspace
- **WHEN** the admin selects the constructors view
- **THEN** the workspace SHALL show one row per configured constructor and one column per configured race
- **AND** each race cell through the cutoff SHALL show constructor points for that race
- **AND** the workspace SHALL show cumulative points and championship position at the cutoff when available

#### Scenario: Evidence is unavailable for a round

- **GIVEN** a configured round has no persisted source bundle
- **WHEN** either matrix renders
- **THEN** affected cells SHALL show an explicit unavailable, incomplete, future, or not-yet-synced state
- **AND** the workspace SHALL not present missing data as a zero result

### Requirement: Admin can inspect one selected round in detail

The system SHALL allow an admin to select a configured round and inspect the persisted evidence used for that round.

#### Scenario: Admin opens a completed round

- **GIVEN** a selected round has a persisted source bundle
- **WHEN** the round detail renders
- **THEN** it SHALL show each known driver with constructor, grid position, qualifying position when available, sprint result when available, race classification, race status, and points
- **AND** it SHALL show import/source metadata and coverage state
- **AND** it SHALL show the derived actual values associated with that round or link directly to the matching Actuals review target

#### Scenario: Admin opens a cancelled, future, or reconstructed round

- **GIVEN** the selected round is cancelled, future, reconstructed, or has no source result
- **WHEN** the round detail renders
- **THEN** it SHALL show the calendar/import state and an explicit explanation
- **AND** it SHALL not fabricate driver results or points

### Requirement: Race data audit is linked to scoring review but remains read-only

The system SHALL connect persisted source evidence to the derived actual snapshot without allowing the audit page to mutate scoring state.

#### Scenario: Admin follows derived actuals

- **GIVEN** a selected round has both source evidence and a derived actual snapshot
- **WHEN** the admin chooses the Actuals review action
- **THEN** the system SHALL open the existing Actuals review target for that round
- **AND** the audit page SHALL preserve the selected cutoff context

#### Scenario: Admin submits a mutation to the audit route

- **GIVEN** an authenticated admin sends a state-changing request to the Race data audit route
- **WHEN** the request is processed
- **THEN** the system SHALL reject the mutation
- **AND** live actuals, snapshots, and review status SHALL remain unchanged

#### Scenario: Non-admin requests the audit workspace

- **GIVEN** a signed-out user or authenticated non-admin requests the Race data workspace
- **WHEN** the request is processed
- **THEN** the system SHALL enforce the existing admin access policy
