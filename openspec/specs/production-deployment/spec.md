# production-deployment Specification

## Purpose
Define how GitHub Actions deploys the Docker Compose app to the existing production server while preserving host-owned state.
## Requirements
### Requirement: GitHub Actions can deploy the production app to the existing server
The production deploy workflow SHALL publish the current runtime bundle to the configured server over SSH and SHALL rebuild the Docker Compose application there.

Feature: Production deployment

Rule: Deployment automation SHALL publish the current runtime files to the configured server path and rebuild the application there.

#### Scenario: Main branch deploy runs from GitHub Actions
- **GIVEN** a commit reaches the main branch and deploy secrets are configured
- **WHEN** the production deploy workflow runs
- **THEN** the workflow SHALL copy the tracked runtime bundle to the configured server path over SSH
- **AND** the workflow SHALL rebuild and restart the Docker Compose `app` service on that server

#### Scenario: Admin triggers a manual production redeploy
- **GIVEN** deploy secrets are configured
- **WHEN** a maintainer starts the production deploy workflow manually
- **THEN** the workflow SHALL deploy the selected ref using the same server-side rollout steps as the automatic deploy path

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

### Requirement: Production apps use MHV central Docker networks
Production apps deployed to the shared server SHALL use MHV-named central Docker networks for shared ingress and database connectivity.

#### Scenario: F1 app joins central networks
- **GIVEN** F1 is deployed to the shared production server
- **WHEN** the Docker Compose overlay is applied
- **THEN** the app SHALL join the external web network named `mhv-web` with alias `f1-app`
- **AND** the app SHALL join the external database network named `mhv-db`

#### Scenario: Central edge routes app traffic
- **GIVEN** central Caddy is running on the shared production server
- **WHEN** a request reaches a configured app domain
- **THEN** Caddy SHALL route over the external Docker network named `mhv-web`
- **AND** the Caddy container SHALL use the platform name `mhv-caddy`

### Requirement: Codex work does not deploy by direct production mutation
Codex-assisted F1 changes SHALL be prepared in isolated worktrees and deployed through the existing production deployment path.

#### Scenario: Codex prepares an F1 change
- **GIVEN** Codex modifies F1 code on the production server
- **WHEN** the change is ready for review
- **THEN** the change SHALL exist in a dedicated Git worktree or branch
- **AND** production deployment SHALL still run through the established GitHub Actions/server deploy workflow
- **AND** Codex SHALL NOT directly mutate the live production checkout as the normal change path
