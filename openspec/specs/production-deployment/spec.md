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
The production deploy workflow SHALL preserve host-managed secrets, SQLite state, and backup ownership while updating application code.

Feature: Production deployment

Rule: GitHub Actions SHALL update application code without replacing host-managed secrets, SQLite state, or off-repo backup automation.

#### Scenario: Deploy keeps server state and host backups intact
- **GIVEN** the target server stores `.env`, SQLite data, and Restic backup jobs outside GitHub Actions
- **WHEN** the deploy workflow publishes a new application revision
- **THEN** the workflow SHALL not overwrite host-managed secret files
- **AND** the workflow SHALL not delete or recreate the mounted application state directory
- **AND** the workflow SHALL leave the existing Cloudflare R2 backup automation untouched

### Requirement: Deployment fails loudly on unhealthy rollouts
The production deploy workflow SHALL verify application health after restart and MUST fail the rollout when the health check does not recover in time.

Feature: Production deployment

Rule: Production deploy automation SHALL verify service health after restart and SHALL stop the workflow on rollout failure.

#### Scenario: Health check succeeds after deploy
- **GIVEN** the server finishes rebuilding the `app` service
- **WHEN** the deploy workflow checks the application health endpoint
- **THEN** the workflow SHALL wait for a successful `GET /healthz` response before reporting success

#### Scenario: Health check fails after deploy
- **GIVEN** the rebuilt `app` service does not become healthy in time
- **WHEN** the deploy workflow checks the application health endpoint
- **THEN** the workflow SHALL exit with a failed status
- **AND** the workflow SHALL emit recent application logs to aid diagnosis
