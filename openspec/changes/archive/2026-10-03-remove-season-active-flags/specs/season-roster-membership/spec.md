## Purpose

Define season roster membership and round-specific seat occupancy as separate concepts so temporary sidelining, replacements, and historical seasons remain unambiguous.

## ADDED Requirements

### Requirement: Season membership is represented by row existence

The system SHALL treat the presence of a season driver or season team record as membership in that season, without a separate active/inactive flag.

#### Scenario: Driver is included in a season roster

- **GIVEN** a canonical driver exists
- **WHEN** a season driver record exists for the selected season
- **THEN** the driver SHALL be available as a season input and as a lineup candidate

#### Scenario: Driver is removed without assignment history

- **GIVEN** a season driver record has no seat assignments in that season
- **WHEN** an admin removes the driver from the season roster
- **THEN** the season membership record SHALL be removed
- **AND** the canonical driver identity SHALL remain available for other seasons

### Requirement: Seat occupancy is derived from round-bounded assignments

The system SHALL determine whether a driver occupies a race seat from an assignment interval covering the selected round, not from roster membership.

#### Scenario: Driver is temporarily sidelined

- **GIVEN** a driver has an assignment for rounds 1–7 and another assignment beginning at round 10
- **WHEN** the lineup is projected for round 8
- **THEN** the driver SHALL occupy no race seat for round 8
- **AND** the driver SHALL occupy the later seat again from round 10

#### Scenario: Driver replacement starts mid-season

- **GIVEN** a prior driver assignment ends at round N-1
- **WHEN** a replacement assignment starts at round N
- **THEN** the projection before N SHALL resolve the prior driver
- **AND** the projection from N onward SHALL resolve the replacement

### Requirement: Historical assignments protect season membership

The system SHALL not remove a season driver or team membership record when historical seat assignments still reference it.

#### Scenario: Admin removes a referenced driver or team

- **GIVEN** the selected season member has one or more seat assignments
- **WHEN** an admin requests removal from the season roster
- **THEN** the request SHALL be rejected with an actionable explanation
- **AND** the membership and assignment records SHALL remain unchanged
