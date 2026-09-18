# wok-preview-lifecycle Specification

## Purpose
TBD - created by archiving change standardize-wok-preview-and-runtime. Update Purpose after archive.
## Requirements
### Requirement: WOK previews use isolated app resources
The system SHALL create each WOK preview from an exact Git ref using a dedicated worktree, compose project, generated app secret, distinct PostgreSQL database and role, and disposable file-state directory.

#### Scenario: Operator creates a preview
- **GIVEN** the WOK registry entry is valid and an exact Git ref is supplied
- **WHEN** the operator creates preview identifier `123`
- **THEN** the system SHALL create a worktree and runtime resources scoped to that identifier
- **AND** it SHALL not write to the live production checkout or production database
- **AND** the preview SHALL report its exact ref and resource names

### Requirement: Active previews have explicit protected routes
The system SHALL route an active WOK preview at `wok-preview-<id>.mhvmade.com` only while its resources are healthy and its explicit Caddy route is installed.

#### Scenario: Preview becomes reachable
- **GIVEN** a preview container passes its health check
- **WHEN** the preview route is activated
- **THEN** Caddy SHALL route the exact preview hostname to that preview container over `mhv-web`
- **AND** access protection SHALL remain enabled
- **AND** the production `wheelofknowledge.com` route SHALL remain unchanged

### Requirement: Preview cleanup is scoped and complete
The system SHALL remove an expired or explicitly deleted preview's container, route, worktree, database, role, disposable file state, and metadata without modifying production resources.

#### Scenario: Operator removes a preview
- **GIVEN** preview identifier `123` exists
- **WHEN** the operator removes exactly preview `123`
- **THEN** only resources recorded for `123` SHALL be removed
- **AND** the production container, route, database, and state SHALL remain available

### Requirement: Preview status exposes verification evidence
The system SHALL provide preview status showing the exact ref, hostname, health result, database isolation identity, creation time, expiry time, and cleanup state without printing secrets.

#### Scenario: Operator inspects a preview
- **GIVEN** preview `123` is active
- **WHEN** the operator requests its status
- **THEN** the system SHALL show the preview URL and health state
- **AND** it SHALL redact passwords, session secrets, and database connection credentials

