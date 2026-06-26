## MODIFIED Requirements

### Requirement: Deployment preserves server-owned state and backup responsibilities
The production deploy workflow SHALL preserve host-managed secrets, PostgreSQL connection settings, central database state, and backup ownership while updating application code.

Feature: Production deployment

Rule: GitHub Actions SHALL update application code without replacing host-managed secrets, central PostgreSQL state, or off-repo backup automation.

#### Scenario: Deploy keeps server state and host backups intact
- **GIVEN** the target server stores `.env`, PostgreSQL connection settings, central PostgreSQL data, and backup jobs outside GitHub Actions
- **WHEN** the deploy workflow publishes a new application revision
- **THEN** the workflow SHALL not overwrite host-managed secret files
- **AND** the workflow SHALL not delete or recreate the central PostgreSQL data volume
- **AND** the workflow SHALL not replace the F1 PostgreSQL connection string with SQLite-only configuration
- **AND** the workflow SHALL leave off-repo backup automation untouched

### Requirement: Deployment fails loudly on unhealthy rollouts
The production deploy workflow SHALL verify application health after restart and MUST fail the rollout when the health check does not recover in time.

Feature: Production deployment

Rule: Production deploy automation SHALL verify service health after restart and SHALL stop the workflow on rollout failure.

#### Scenario: Health check succeeds after deploy
- **GIVEN** the server finishes rebuilding the `app` service
- **WHEN** the deploy workflow checks the application health endpoint
- **THEN** the workflow SHALL wait for a successful `GET /healthz` response before reporting success
- **AND** the health response SHALL confirm database connectivity through the active production database backend

#### Scenario: Health check fails after deploy
- **GIVEN** the rebuilt `app` service does not become healthy in time
- **WHEN** the deploy workflow checks the application health endpoint
- **THEN** the workflow SHALL exit with a failed status
- **AND** the workflow SHALL emit recent application logs to aid diagnosis
