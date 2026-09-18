# sanitized-wok-preview-data Specification

## Purpose
TBD - created by archiving change sanitize-public-wok-previews. Update Purpose after archive.
## Requirements
### Requirement: Public previews use sanitized data only
The system SHALL provision a public WOK preview from an empty preview PostgreSQL database and SHALL NOT restore a production database dump or copy registered production file state into that preview.

#### Scenario: Sanitized preview is created
- **WHEN** an operator creates a preview in `sanitized` mode
- **THEN** the preview database is created with its own `wok_preview_<id>` name and role
- **AND** no production database dump is restored
- **AND** the preview state directory starts empty

### Requirement: Sanitized previews contain deterministic review fixtures
The system SHALL seed a sanitized preview after the app schema is healthy with fake, deterministic race-review data sufficient to render the admin actuals review workspace.

#### Scenario: Preview admin opens actuals review
- **WHEN** the sanitized preview is healthy
- **THEN** its database contains at least one pending race snapshot and associated snapshot value
- **AND** the snapshot source is identified as preview fixture data
- **AND** no production user, answer, or snapshot identifier is copied into the preview

### Requirement: Sanitized preview authentication is isolated
The system SHALL use a preview-only generated session secret and a development-only fake admin identity for sanitized previews, without reading production credentials.

#### Scenario: Public preview authenticates
- **WHEN** a visitor reaches a sanitized preview
- **THEN** the app can provide its preview admin review experience through the development-only auto-login path
- **AND** the session secret and identity are scoped to that preview container
- **AND** production authentication data is not used

