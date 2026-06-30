# central-backup-automation Specification

## Purpose
Define how the shared MHV production server creates, retains, and exports central backup outputs without placing host secrets in the application repository.

## Requirements
### Requirement: Host backup entrypoints use MHV platform naming
The production server SHALL expose host-level backup commands and scheduled jobs under MHV platform naming.

#### Scenario: Operator inspects backup automation
- **GIVEN** the production server hosts multiple MHV apps
- **WHEN** an operator lists backup commands and cron entries
- **THEN** the active host-level backup command SHALL be named `mhv-backup`
- **AND** the active host-level prune command SHALL be named `mhv-backup-prune`
- **AND** the active cron entry SHALL use `mhv-backup` naming instead of app-specific `wok-backup` naming

### Requirement: Central PostgreSQL dumps are scheduled
The production server SHALL create central PostgreSQL dumps on an automatic schedule and retain recent dump files locally for recovery.

#### Scenario: Scheduled dump job runs
- **GIVEN** the central PostgreSQL service is healthy
- **WHEN** the scheduled PostgreSQL backup job runs
- **THEN** it SHALL create a timestamped dump under `/srv/infra/postgres/backups`
- **AND** the dump file SHALL have owner-only permissions
- **AND** the job SHALL fail visibly when PostgreSQL cannot be dumped

#### Scenario: Old dump retention runs
- **GIVEN** central PostgreSQL dump files exist under `/srv/infra/postgres/backups`
- **WHEN** retention runs
- **THEN** dump files older than the configured retention window SHALL be removed
- **AND** recent dump files SHALL remain available for restore testing

### Requirement: Remote backup includes central backup outputs
The host-level encrypted remote backup job SHALL include central backup outputs needed to recover shared platform state.

#### Scenario: Host backup captures PostgreSQL backup outputs
- **GIVEN** the central PostgreSQL backup directory contains dump files
- **WHEN** `mhv-backup` runs
- **THEN** the encrypted remote backup SHALL include the central PostgreSQL backup directory contents
- **AND** the backup metadata SHALL identify the source host and backup creation time

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
