## ADDED Requirements

### Requirement: Drivers view separates identity from lineup relationships
The admin Inputs Drivers view SHALL show season driver number, driver name, optional short code, nationality, and derived age. It SHALL NOT show a derived Team column because team membership is time-bounded and managed in the Teams view.

#### Scenario: Drivers table presents compact profile context
- **GIVEN** an admin opens Drivers for a selected season
- **WHEN** the table renders
- **THEN** the columns are `#`, Driver, Code, Nationality, and Age
- **AND** the table contains no Team column

#### Scenario: Driver editor exposes profile fields
- **GIVEN** an admin selects a driver or adds a driver
- **WHEN** the driver editor opens
- **THEN** it offers name, season number, short code, nationality, and date of birth
- **AND** team assignment controls are absent
