## ADDED Requirements

### Requirement: Admin navigation exposes resolution workflow
The admin interface SHALL expose Codex resolution runs through the existing admin navigation and layout patterns.

#### Scenario: Admin opens resolution runs from navigation
- **GIVEN** an authenticated admin is on an admin page
- **WHEN** the admin navigation renders
- **THEN** it SHALL include a link to the resolution runs page
- **AND** the link SHALL show an active state when the admin is viewing resolution-run pages

#### Scenario: Resolution pages fit supported viewports
- **GIVEN** an authenticated admin opens a resolution-run list or detail page on desktop or phone
- **WHEN** the page renders run cards, timelines, validation results, and action forms
- **THEN** the page SHALL avoid document-level horizontal overflow
- **AND** action controls SHALL wrap or stack without overlapping

#### Scenario: Resolution list is scannable
- **GIVEN** an authenticated admin opens the resolution-run list
- **WHEN** the page renders queued, running, failed, ready-to-test, and scheduled runs
- **THEN** each run row SHALL show a status badge, linked idea title, run type, last activity time, and next action
- **AND** the page SHALL visually distinguish runs that are waiting for admin action

#### Scenario: Run detail gives one primary next action
- **GIVEN** an authenticated admin opens a resolution-run detail page
- **WHEN** the run has a known lifecycle state
- **THEN** the page SHALL present one primary next action that matches the state
- **AND** secondary actions SHALL remain available without competing with the primary action

### Requirement: Resolution mutations use shared form protection
The admin interface SHALL require the shared form action protection for state-changing resolution-run mutations.

#### Scenario: Resolution mutation without CSRF token is rejected
- **GIVEN** an admin has an active session
- **WHEN** a resolution-run mutation is submitted without the current CSRF token
- **THEN** the system SHALL reject the request
- **AND** the mutation SHALL not be applied

#### Scenario: Resolution mutation with CSRF token succeeds
- **GIVEN** an admin has an active session and a rendered form token
- **WHEN** the admin submits a valid resolution-run mutation with the matching token
- **THEN** the system SHALL apply the mutation according to the endpoint rules
