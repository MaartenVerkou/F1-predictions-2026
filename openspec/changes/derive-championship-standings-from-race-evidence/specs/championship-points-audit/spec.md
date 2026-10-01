## Purpose

Provides a single, evidence-derived championship points view and a safe comparison path for replacing imported standings without changing reviewed answer history.

## ADDED Requirements

### Requirement: Championship standings are derived from canonical race evidence
The system SHALL derive driver and constructor championship standings from persisted Grand Prix and sprint result evidence through the selected round cutoff.

#### Scenario: Driver totals include race and sprint points
- **GIVEN** persisted race and sprint rows exist through a selected round
- **WHEN** the driver championship is derived
- **THEN** each driver's total SHALL equal the sum of the season scoring rules applied to that driver's race and sprint rows
- **AND** drivers SHALL be ordered by the derived championship ranking

#### Scenario: Constructor totals aggregate canonical driver results
- **GIVEN** persisted race and sprint rows identify a constructor for each driver
- **WHEN** the constructor championship is derived
- **THEN** each constructor total SHALL aggregate its drivers' derived points
- **AND** the constructor result SHALL not depend on an external standings endpoint

#### Scenario: Incomplete evidence is visible instead of silently scored
- **GIVEN** a round is missing required race or sprint evidence
- **WHEN** championship totals are requested through that cutoff
- **THEN** the affected values SHALL be marked incomplete or unavailable
- **AND** the system SHALL not silently replace missing evidence with an imported standings value

### Requirement: Race Data exposes direct Points and cumulative Championship points results
The championship table SHALL provide a `Points` variant showing per-round derived points with a cumulative total and a `Championship points results` variant showing the cumulative standings result used for comparison. Both variants SHALL use the same canonical entities and season/round context.

#### Scenario: Admin compares direct points with championship results
- **GIVEN** an admin selects a season and cutoff round in Race Data
- **WHEN** the admin switches between `Points` and `Championship points results`
- **THEN** the table SHALL keep the selected entities and round context
- **AND** `Points` SHALL show points scored in each round and the cumulative total
- **AND** `Championship points results` SHALL show the derived cumulative championship result and ranking

#### Scenario: Existing imported standings differ from derived results
- **GIVEN** stored historical standings exist for a round
- **AND** evidence-derived totals differ from those standings
- **WHEN** the comparison variant renders
- **THEN** the difference SHALL be visible as a reconciliation state
- **AND** the historical value SHALL remain readable
- **AND** the derived value SHALL not be published automatically

### Requirement: Actuals and public scoring share the evidence-derived calculation
The actuals derivation and public scoring pipeline SHALL consume the same evidence-derived championship calculation and SHALL not call a standings provider during rendering or sync.

#### Scenario: A race result correction changes a championship answer
- **GIVEN** an admin corrects a persisted race result
- **WHEN** the round is re-derived
- **THEN** the Points and Championship points results views SHALL reflect the correction
- **AND** the affected actual snapshot SHALL be regenerated for review

#### Scenario: Reviewed answers remain stable until republished
- **GIVEN** a derived snapshot has been reviewed and published
- **WHEN** a later import produces different evidence
- **THEN** the system SHALL create a pending replacement snapshot
- **AND** it SHALL not overwrite the published answer set implicitly
