## MODIFIED Requirements

### Requirement: Admin navigation exposes ideas inbox

The system SHALL expose the Inputs workspace before Questions in the existing admin navigation, while preserving the existing ideas and other admin links.

#### Scenario: Admin opens Inputs from navigation

- **GIVEN** an authenticated admin is on an admin page
- **WHEN** the admin navigation renders
- **THEN** it SHALL include an Inputs link before Questions
- **AND** the Inputs link SHALL show an active state when the Inputs workspace is open

#### Scenario: Existing admin links remain available

- **GIVEN** the admin navigation includes Inputs
- **WHEN** an admin opens Questions, Race data, Actuals, Analysis, or Ideas
- **THEN** those links SHALL remain available with their existing active-state behavior
