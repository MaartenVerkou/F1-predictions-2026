## ADDED Requirements

### Requirement: Admin navigation exposes ideas inbox
The system SHALL expose the admin ideas inbox through the existing admin navigation.

Feature: Admin interface

Rule: Admin navigation SHALL include the ideas page without breaking existing admin layout behavior.

#### Scenario: Admin opens ideas from admin navigation
- **GIVEN** an authenticated admin is on an admin page
- **WHEN** the admin navigation renders
- **THEN** it SHALL include a link to the admin ideas page
- **AND** the ideas link SHALL show an active state when the admin is on the ideas page

#### Scenario: Admin ideas page fits supported viewports
- **GIVEN** an authenticated admin opens the ideas page on desktop or phone
- **WHEN** the page renders the create form and idea lists
- **THEN** the page SHALL avoid document-level horizontal overflow
- **AND** action controls SHALL wrap or stack without overlapping
