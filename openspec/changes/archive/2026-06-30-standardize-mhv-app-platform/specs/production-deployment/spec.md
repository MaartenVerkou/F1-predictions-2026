## ADDED Requirements

### Requirement: Production deployment uses registered app metadata
Production deployment automation SHALL use registered app metadata to determine where and how an app is deployed on the MHV server.

#### Scenario: Deployment starts for a registered app
- **GIVEN** an app is registered in the MHV app registry
- **WHEN** its production deployment starts
- **THEN** deployment SHALL use the registered production path
- **AND** deployment SHALL use the registered Docker service names
- **AND** deployment SHALL verify the registered health endpoint before reporting success

#### Scenario: Deployment targets an unregistered app
- **GIVEN** an app has no registry entry
- **WHEN** platform deployment automation is asked to deploy it
- **THEN** deployment SHALL fail before modifying server state
- **AND** the failure SHALL explain that the app must be registered first

### Requirement: App path migrations are verified before cutover
The platform SHALL treat production path migration as a separate verified operation from ordinary code deployment.

#### Scenario: Existing app path is migrated
- **GIVEN** an app currently runs from a non-standard server path
- **WHEN** the operator migrates it to `/srv/apps/<app>/current`
- **THEN** the migration SHALL create or confirm a rollback path
- **AND** it SHALL preserve host-managed secrets
- **AND** it SHALL preserve persistent state
- **AND** it SHALL pass the registered health check before Caddy routing is changed

#### Scenario: Migration health check fails
- **GIVEN** an app migration has started
- **WHEN** the migrated app fails its registered health check
- **THEN** Caddy routing SHALL remain pointed at the previously healthy deployment
- **AND** the migration SHALL be marked failed for operator review
