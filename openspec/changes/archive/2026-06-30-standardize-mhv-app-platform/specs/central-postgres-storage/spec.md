## ADDED Requirements

### Requirement: App registry drives central PostgreSQL provisioning
Central PostgreSQL provisioning SHALL use app registry metadata to create isolated databases and roles for apps that need PostgreSQL.

#### Scenario: Registered app requests PostgreSQL
- **GIVEN** an app registry entry declares that the app needs PostgreSQL
- **WHEN** database provisioning runs
- **THEN** the platform SHALL create or verify a dedicated database for that app
- **AND** it SHALL create or verify a dedicated role for that app
- **AND** the role SHALL NOT be reused by another app
- **AND** the app SHALL connect through the internal `mhv-db` network and `mhv-postgres` hostname

#### Scenario: Registered app does not need PostgreSQL
- **GIVEN** an app registry entry declares no PostgreSQL requirement
- **WHEN** database provisioning runs
- **THEN** the platform SHALL NOT create a database or role for that app
- **AND** the app SHALL NOT receive credentials for another app database

### Requirement: Database migrations are part of app onboarding
Apps that use central PostgreSQL SHALL declare how schema migrations are applied and verified before production deploy succeeds.

#### Scenario: App declares migration command
- **GIVEN** a registered app uses PostgreSQL
- **WHEN** the onboarding check reviews the app runtime contract
- **THEN** the app SHALL declare a migration command or explicitly declare that no migration step is required
- **AND** production deployment SHALL run or verify that migration step according to the app contract

#### Scenario: Migration fails
- **GIVEN** a registered app deployment requires a database migration
- **WHEN** the migration command fails
- **THEN** production deployment SHALL fail before reporting the app healthy
- **AND** recent migration output SHALL be available to the operator
