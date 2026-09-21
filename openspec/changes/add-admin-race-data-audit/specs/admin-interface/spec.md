## ADDED Requirements

### Requirement: Admin navigation exposes the Race data audit workspace

The system SHALL expose the admin-only Race data audit workspace through the existing admin navigation.

#### Scenario: Admin opens Race data from navigation

- **GIVEN** an authenticated admin is on an admin page
- **WHEN** the admin navigation renders
- **THEN** it SHALL include a Race data link
- **AND** the link SHALL show an active state when the Race data workspace is open
