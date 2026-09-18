## MODIFIED Requirements

### Requirement: Preview hostnames follow the MHV naming contract
Preview environments SHALL use registered app slugs and first-level MHV hostnames that work with the shared wildcard DNS pattern. WOK preview creation SHALL be backed by an executable lifecycle that records the route and resource ownership for each active preview.

#### Scenario: Preview is created for a registered app
- **GIVEN** an app has slug `wok`
- **WHEN** a preview environment is created for resolution run `123`
- **THEN** its public preview hostname SHALL follow the pattern `wok-preview-123.mhvmade.com`
- **AND** the preview hostname SHALL be registered in the edge routing layer only while the preview is active
- **AND** the preview metadata SHALL record the exact ref and cleanup owner

#### Scenario: Preview expires
- **GIVEN** a preview environment has passed its retention window
- **WHEN** preview cleanup runs
- **THEN** the preview container, preview route, and preview database or file-state clone SHALL be removed
- **AND** the production app state SHALL remain unchanged
