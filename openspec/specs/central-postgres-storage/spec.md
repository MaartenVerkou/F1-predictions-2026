# central-postgres-storage Specification

## Purpose
Define how the shared production server provides central PostgreSQL storage for apps while preserving per-app database and role isolation.
## Requirements
### Requirement: Central PostgreSQL service hosts app databases
The production server SHALL host app databases through a central PostgreSQL service with per-app database and role isolation.

Feature: Central PostgreSQL storage

Rule: The server SHALL provide one central PostgreSQL service for production apps while isolating each app by database and role.

#### Scenario: F1 database is provisioned centrally
- **GIVEN** central PostgreSQL infrastructure is deployed on the production server
- **WHEN** the F1 application is configured for PostgreSQL
- **THEN** F1 SHALL connect to a dedicated PostgreSQL database using a dedicated database role
- **AND** PostgreSQL SHALL not expose a public host port
- **AND** F1 SHALL reach PostgreSQL over an internal Docker network

#### Scenario: Future app receives isolated database access
- **GIVEN** another app is added to the server later
- **WHEN** that app needs PostgreSQL storage
- **THEN** the operator SHALL create a separate database and role for that app
- **AND** the app SHALL NOT reuse the F1 database role

### Requirement: SQLite production data can be migrated to PostgreSQL
The system SHALL provide a migration path from the existing F1 SQLite production database to the F1 PostgreSQL database.

Feature: SQLite to PostgreSQL migration

Rule: The F1 production migration SHALL preserve existing application data and provide verification before cutover.

#### Scenario: Migration imports existing F1 data
- **GIVEN** the production SQLite database exists before migration
- **WHEN** the migration runs
- **THEN** the migration SHALL create compatible PostgreSQL tables
- **AND** it SHALL import rows from the existing SQLite application database into the F1 PostgreSQL database
- **AND** it SHALL report row counts for verification

#### Scenario: Migration preserves rollback state
- **GIVEN** the migration starts on the production server
- **WHEN** the migration prepares PostgreSQL data
- **THEN** the existing SQLite database files SHALL remain available for rollback
- **AND** the pre-migration app configuration SHALL be backed up before cutover

### Requirement: F1 sessions use PostgreSQL in production
The F1 production application SHALL store session data in PostgreSQL when configured with the central PostgreSQL connection string.

Feature: PostgreSQL-backed sessions

Rule: Production sessions SHALL be stored in PostgreSQL after the F1 database cutover.

#### Scenario: Session store uses central PostgreSQL
- **GIVEN** F1 is configured with a PostgreSQL connection string
- **WHEN** a user signs in or continues an existing browser session
- **THEN** session data SHALL be stored in PostgreSQL-backed session storage
- **AND** the application SHALL not create or require `sessions.db` for production session storage

#### Scenario: Expired sessions are pruned
- **GIVEN** PostgreSQL-backed session storage contains expired sessions
- **WHEN** the session pruning interval runs
- **THEN** expired sessions SHALL be removed without affecting active sessions

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
