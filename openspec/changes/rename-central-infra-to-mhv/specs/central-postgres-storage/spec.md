## ADDED Requirements

### Requirement: Central PostgreSQL uses MHV platform naming
The production server SHALL expose central PostgreSQL through MHV-named platform infrastructure.

#### Scenario: App connects to central PostgreSQL
- **GIVEN** a production app uses the central PostgreSQL service
- **WHEN** the app container starts
- **THEN** it SHALL join the internal Docker network named `mhv-db`
- **AND** it SHALL connect to PostgreSQL through the internal hostname `mhv-postgres`
- **AND** PostgreSQL SHALL not expose a public host port

#### Scenario: Operator inspects central PostgreSQL container
- **GIVEN** central PostgreSQL is running on the production server
- **WHEN** an operator lists Docker containers
- **THEN** the central PostgreSQL container SHALL use the platform name `mhv-postgres`
- **AND** app-specific database names and roles SHALL remain isolated per app
