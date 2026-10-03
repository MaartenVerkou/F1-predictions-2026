## MODIFIED Requirements

### Requirement: Apps are registered in the MHV app registry

The platform SHALL maintain an app registry that records the operational metadata needed to deploy and operate each app on the shared MHV server. Each app SHALL have one canonical platform identity used by the app contract, registry, preview naming, and deployment documentation; compatibility aliases MUST be explicit and MUST NOT become a second source of truth.

#### Scenario: Operator registers an app

- **GIVEN** an app is intended to run on the MHV server
- **WHEN** the operator creates or updates its registry entry
- **THEN** the entry SHALL include the app slug, repository URL, current production path, target production path, public hostnames, Docker service names, health endpoint, database requirements, backup state paths, Codex environment metadata, and preview hostname pattern
- **AND** the app slug SHALL be unique across registered apps
- **AND** the app contract SHALL resolve to the same canonical identity

#### Scenario: Existing app keeps current path during transition

- **GIVEN** an existing production app runs outside `/srv/apps/<app>/current`
- **WHEN** it is added to the registry
- **THEN** the registry SHALL record the existing production path
- **AND** the registry SHALL record the target `/srv/apps/<app>/current` path separately
- **AND** the platform SHALL NOT require an immediate path move to consider the app registered

#### Scenario: Compatibility alias is retained

- **GIVEN** an existing app has a legacy repository slug or deployment path
- **WHEN** its canonical identity is normalized
- **THEN** the alias SHALL be documented as compatibility metadata
- **AND** registry validation SHALL reject a second canonical entry for the same app
- **AND** public hostnames, database keys, and rollback paths SHALL remain unchanged until a separate migration is approved
