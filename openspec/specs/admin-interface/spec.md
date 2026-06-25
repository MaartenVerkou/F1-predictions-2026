# admin-interface Specification

## Purpose
TBD - created by archiving change polish-admin-responsive-locales. Update Purpose after archive.
## Requirements
### Requirement: Admin pages fit supported viewports
The system SHALL render admin pages within supported phone and desktop viewports without page-level horizontal overflow.

Feature: Admin interface

Rule: Admin pages SHALL avoid page-level horizontal overflow while preserving dense operational data.

#### Scenario: Season actuals fits on phone
- **GIVEN** an admin opens the Season actuals page on a phone-width viewport
- **WHEN** the page renders questions, target controls, review panels, and save controls
- **THEN** primary inputs and action controls SHALL fit within the viewport
- **AND** the page SHALL not create document-level horizontal scrolling
- **AND** DNF-per-race controls SHALL remain readable and operable

#### Scenario: Wide admin tables scroll inside their own region
- **GIVEN** an admin opens overview, detail, question settings, or analysis pages with wide tables
- **WHEN** the viewport is narrower than the table's useful minimum width
- **THEN** the table SHALL scroll horizontally inside a bounded table region
- **AND** the document itself SHALL not overflow horizontally
- **AND** long IDs, answers, and names SHALL wrap or truncate within their cells instead of expanding the page

#### Scenario: Admin action rows wrap predictably
- **GIVEN** an admin page contains multiple links, forms, or buttons in the same action area
- **WHEN** the viewport is narrow
- **THEN** the action controls SHALL wrap or stack without overlapping
- **AND** destructive actions SHALL remain visibly separate from navigation actions

### Requirement: Admin layout uses reusable presentation classes
The system SHALL use shared presentation classes for repeated admin layout concerns.

Feature: Admin interface

Rule: Shared admin layout concerns SHALL be expressed through reusable CSS classes rather than repeated inline styles.

#### Scenario: Admin templates share page structure helpers
- **GIVEN** admin templates render headers, action rows, detail tables, status panels, or table scroll areas
- **WHEN** the templates are inspected
- **THEN** repeated layout decisions SHALL use shared classes
- **AND** inline styles SHALL be limited to data-specific or exceptional presentation that cannot be shared cleanly

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

### Requirement: Admin mutations use shared form protection
The admin interface SHALL require the shared form action protection for state-changing admin mutations.

Feature: Admin interface

Rule: Admin mutation forms SHALL participate in the shared unsafe-action protection layer.

#### Scenario: Admin mutation without CSRF token is rejected
- **GIVEN** an admin has an active session
- **WHEN** an admin mutation request is submitted without the current CSRF token
- **THEN** the system rejects the request
- **AND** the admin mutation is not applied

#### Scenario: Admin mutation with CSRF token succeeds
- **GIVEN** an admin has an active session and a rendered form token
- **WHEN** the admin submits a valid mutation form with the matching token
- **THEN** the system applies the mutation according to the endpoint rules
