## ADDED Requirements

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
