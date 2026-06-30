# mhv-app-platform Specification

## Purpose
Define the shared platform contract for registering, onboarding, previewing, deploying, and operating separate app repositories on the MHV server.

## Requirements
### Requirement: Apps are registered in the MHV app registry
The platform SHALL maintain an app registry that records the operational metadata needed to deploy and operate each app on the shared MHV server.

#### Scenario: Operator registers an app
- **GIVEN** an app is intended to run on the MHV server
- **WHEN** the operator creates or updates its registry entry
- **THEN** the entry SHALL include the app slug, repository URL, current production path, target production path, public hostnames, Docker service names, health endpoint, database requirements, backup state paths, Codex environment metadata, and preview hostname pattern
- **AND** the app slug SHALL be unique across registered apps

#### Scenario: Existing app keeps current path during transition
- **GIVEN** an existing production app runs outside `/srv/apps/<app>/current`
- **WHEN** it is added to the registry
- **THEN** the registry SHALL record the existing production path
- **AND** the registry SHALL record the target `/srv/apps/<app>/current` path separately
- **AND** the platform SHALL NOT require an immediate path move to consider the app registered

### Requirement: App repositories provide a production runtime contract
Each app repository deployed through the MHV platform SHALL expose the runtime and verification commands required for repeatable production deployment.

#### Scenario: App repo is evaluated for onboarding
- **GIVEN** a repository is being onboarded as an MHV app
- **WHEN** the onboarding check runs
- **THEN** the repository SHALL declare a production Docker runtime
- **AND** it SHALL declare a health check endpoint
- **AND** it SHALL declare build, test, and deploy verification commands
- **AND** it SHALL document required environment variables without committing secret values

#### Scenario: App uses persistent state
- **GIVEN** an onboarded app stores persistent data outside its container image
- **WHEN** the app registry entry is reviewed
- **THEN** every persistent state path SHALL be classified as database state, file state, generated cache, or disposable runtime state
- **AND** backup inclusion SHALL be explicit for each non-disposable state path

### Requirement: New apps use the standard server layout
New MHV apps SHALL use the standard `/srv/apps/<app>` server layout unless an explicit compatibility exception is recorded.

#### Scenario: New app is deployed
- **GIVEN** a new app is being deployed to the MHV server
- **WHEN** its production path is provisioned
- **THEN** its checkout SHALL live under `/srv/apps/<app>/current`
- **AND** its host-managed shared state SHALL live under `/srv/apps/<app>/shared`
- **AND** app-specific release or rollback directories SHALL stay under `/srv/apps/<app>`

#### Scenario: Existing app is migrated to standard layout
- **GIVEN** an existing app has a registry entry with a non-standard current path
- **WHEN** the operator migrates it to `/srv/apps/<app>/current`
- **THEN** the migration SHALL preserve host-managed secrets and persistent state
- **AND** it SHALL keep a rollback path to the previous production path until health checks pass
- **AND** public hostnames SHALL remain unchanged

### Requirement: Unknown wildcard hostnames fail closed
The MHV platform SHALL use wildcard DNS only as an ingress convenience; app routing SHALL remain explicit.

#### Scenario: Request targets a registered hostname
- **GIVEN** a hostname is listed in an app registry entry
- **WHEN** a request reaches central Caddy for that hostname
- **THEN** Caddy SHALL route the request to the registered app service or redirect target

#### Scenario: Request targets an unknown wildcard hostname
- **GIVEN** a first-level `mhvmade.com` hostname is not registered and is not an active preview hostname
- **WHEN** a request reaches the MHV edge
- **THEN** the platform SHALL NOT forward the request to a default app
- **AND** the request SHALL fail closed

### Requirement: Preview hostnames follow the MHV naming contract
Preview environments SHALL use registered app slugs and first-level MHV hostnames that work with the shared wildcard DNS pattern.

#### Scenario: Preview is created for a registered app
- **GIVEN** an app has slug `wok`
- **WHEN** a preview environment is created for resolution run `123`
- **THEN** its public preview hostname SHALL follow the pattern `wok-preview-123.mhvmade.com`
- **AND** the preview hostname SHALL be registered in the edge routing layer only while the preview is active

#### Scenario: Preview expires
- **GIVEN** a preview environment has passed its retention window
- **WHEN** preview cleanup runs
- **THEN** the preview container, preview route, and preview database or file-state clone SHALL be removed
- **AND** the production app state SHALL remain unchanged
