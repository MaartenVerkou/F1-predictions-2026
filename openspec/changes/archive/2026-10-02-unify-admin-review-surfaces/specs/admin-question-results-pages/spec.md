## ADDED Requirements

### Requirement: Questions and Results are separate season-aware admin pages
The system SHALL provide `/admin/questions` for question input configuration and `/admin/results` for the read-only question-results matrix, with the selected season preserved by both pages.

#### Scenario: Admin opens Questions
- **WHEN** an admin opens `/admin/questions?season=2026`
- **THEN** the page SHALL show question wording, order, scoring, and inclusion controls only
- **AND** it SHALL not render the question-results matrix

#### Scenario: Admin opens Results
- **WHEN** an admin opens `/admin/results?season=2026`
- **THEN** the page SHALL show the question-results matrix for season 2026
- **AND** it SHALL use the shared bounded answer projection used by the existing results view

### Requirement: Legacy result links resolve to the Results page
The system SHALL preserve existing result links by redirecting `/admin/actuals` and `/admin/questions?view=results` to `/admin/results` while retaining the selected season.

#### Scenario: Existing Actuals bookmark is opened
- **WHEN** an admin requests `/admin/actuals?season=2026`
- **THEN** the response SHALL redirect to `/admin/results?season=2026`
- **AND** no stored answer or review state SHALL be changed

#### Scenario: Legacy Questions result mode is opened
- **WHEN** an admin requests `/admin/questions?season=2026&view=results`
- **THEN** the response SHALL redirect to `/admin/results?season=2026`

### Requirement: Admin navigation exposes focused Questions and Results links
The admin navigation SHALL expose distinct Questions and Results links with active styling based on the current route.

#### Scenario: Admin navigates between question surfaces
- **WHEN** the admin is on Questions or Results
- **THEN** the navigation SHALL show separate links for Questions and Results
- **AND** only the current page link SHALL have the active state

### Requirement: Questions editing uses the shared admin toolbar
The Questions page SHALL place one compact Edit data action above its table using the same reusable toolbar/button styling as Race Data.

#### Scenario: Admin enters question edit mode
- **WHEN** the admin opens Questions and activates Edit data
- **THEN** the question table SHALL enter its existing edit state
- **AND** the toolbar SHALL remain aligned with the table without a second page-specific button style
