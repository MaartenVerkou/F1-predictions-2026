## Purpose

Provides reusable, season-independent driver identity metadata while keeping team and seat periods in the season lineup model.

## ADDED Requirements

### Requirement: Driver profiles expose optional identity metadata
The system SHALL store an optional official short code, nationality code, and date of birth on each canonical driver profile. Driver/team/seat relationships SHALL remain represented only by season assignments.

#### Scenario: Valid profile metadata is saved
- **GIVEN** an admin edits a driver in a writable season
- **WHEN** the admin submits a valid three-letter driver code, two-letter nationality code, and ISO date of birth
- **THEN** the canonical driver profile stores those values
- **AND** no team or seat relationship is written to the driver profile

#### Scenario: Missing metadata remains allowed
- **GIVEN** a driver has no known code, nationality, or date of birth
- **WHEN** the Drivers view renders
- **THEN** each missing metadata value is displayed as `—`
- **AND** the driver remains editable and usable in assignments

#### Scenario: Invalid metadata is rejected
- **GIVEN** an admin submits a driver code or nationality code with an invalid format, or an invalid date
- **WHEN** the profile mutation is processed
- **THEN** the mutation is rejected with a validation message
- **AND** the existing profile values remain unchanged

### Requirement: Driver age is derived for the selected season
The system SHALL calculate age as completed years at the selected season's first scheduled race date, falling back to 1 January of the selected season when no scheduled race date exists. Age SHALL be derived from date of birth and SHALL NOT be stored as an independent value.

#### Scenario: Age is shown when date of birth is known
- **GIVEN** a selected season and a driver with a valid date of birth
- **WHEN** the Drivers table renders
- **THEN** it shows the driver's completed age as a whole number for that season

#### Scenario: Age is unavailable without date of birth
- **GIVEN** a driver has no date of birth
- **WHEN** the Drivers table renders
- **THEN** the Age cell shows `—`

