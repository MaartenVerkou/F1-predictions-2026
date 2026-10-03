## ADDED Requirements

### Requirement: Inputs does not expose ambiguous activity status

The Inputs Drivers and Teams workflows SHALL not present an Active column, Active checkbox, or activity mutation field for canonical or season roster records.

#### Scenario: Admin opens Drivers inputs

- **GIVEN** an admin opens Drivers for a selected season
- **WHEN** the table renders or a driver editor opens
- **THEN** the UI SHALL show driver number, identity, and relevant season/team information
- **AND** it SHALL not show an Active value or Active checkbox

#### Scenario: Admin opens Teams inputs

- **GIVEN** an admin opens Teams for a selected season
- **WHEN** the table renders or a team editor opens
- **THEN** the UI SHALL show team order and seat periods
- **AND** it SHALL not show an Active value or Active checkbox

### Requirement: Inputs uses assignments as the grid-status explanation

The Inputs workflow SHALL communicate current participation through round-bounded seat periods rather than a global driver status.

#### Scenario: Driver has a gap between assignments

- **GIVEN** a driver has no assignment covering a selected round
- **WHEN** an admin reviews the team lineup history
- **THEN** the gap SHALL remain visible as no seat assignment
- **AND** the system SHALL not label the driver retired or inactive based on that gap
