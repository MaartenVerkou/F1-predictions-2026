## MODIFIED Requirements

### Requirement: Immutable production release

Production SHALL run an explicitly approved GHCR image digest built and scanned by GitHub Actions.

#### Scenario: Approved promotion

- **WHEN** an operator deploys F1 through Apps Hub
- **THEN** the requested image is an exact `ghcr.io` digest
- **AND** the server performs no application image build

### Requirement: Database-safe health gate

Production promotion SHALL preserve external PostgreSQL configuration and reject an accidental fallback database.

#### Scenario: Post-deploy verification

- **WHEN** the new container starts
- **THEN** its internal `/healthz` endpoint succeeds
- **AND** it reports `databaseBackend` as `postgres`
- **OR** the previous local image is restored
