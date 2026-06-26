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
