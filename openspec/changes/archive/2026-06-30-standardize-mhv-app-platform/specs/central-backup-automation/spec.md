## ADDED Requirements

### Requirement: Backup scope uses app registry state classifications
Central backup automation SHALL use app registry metadata to determine which app state must be included in backup outputs.

#### Scenario: Registered app has persistent file state
- **GIVEN** an app registry entry lists persistent file-state paths
- **WHEN** backup validation runs
- **THEN** every listed non-disposable path SHALL be included in host-level backup scope or explicitly marked as backed up elsewhere
- **AND** missing backup coverage SHALL be reported as an operator-visible failure

#### Scenario: Registered app has only disposable runtime state
- **GIVEN** an app registry entry marks a state path as disposable runtime state
- **WHEN** backup validation runs
- **THEN** the platform SHALL NOT require that path to be included in durable backups
- **AND** the disposable classification SHALL be visible in the registry

### Requirement: Restore notes are required for registered apps
Each registered app with durable state SHALL have restore notes that identify how to recover its database and file state.

#### Scenario: App uses central PostgreSQL
- **GIVEN** a registered app uses central PostgreSQL
- **WHEN** restore documentation is checked
- **THEN** the app SHALL identify its database name or registry database key
- **AND** it SHALL identify the central PostgreSQL dump location used for restore

#### Scenario: App stores durable files
- **GIVEN** a registered app stores durable files outside PostgreSQL
- **WHEN** restore documentation is checked
- **THEN** the app SHALL identify the file-state backup source paths
- **AND** it SHALL identify where those files must be restored on the server
