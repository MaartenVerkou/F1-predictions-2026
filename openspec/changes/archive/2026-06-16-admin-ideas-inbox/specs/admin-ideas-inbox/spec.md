## ADDED Requirements

### Requirement: Admins can capture future ideas
The system SHALL provide an admin-only ideas inbox for future question and feature ideas.

Feature: Admin ideas inbox

Rule: Ideas SHALL be persisted with type, title, status, and audit context.

#### Scenario: Admin adds a question idea
- **GIVEN** an authenticated admin is on the admin ideas page
- **WHEN** the admin submits a new idea with type `question` and a non-empty title
- **THEN** the system SHALL persist the idea with status `open`
- **AND** the ideas page SHALL show the new idea in the open list

#### Scenario: Admin adds a feature idea with notes
- **GIVEN** an authenticated admin is on the admin ideas page
- **WHEN** the admin submits a new idea with type `feature`, title, and notes
- **THEN** the system SHALL persist the notes with the idea
- **AND** the ideas page SHALL show the idea type and notes

#### Scenario: Non-admin cannot view ideas
- **GIVEN** a visitor or non-admin user requests the admin ideas page
- **WHEN** the request is handled
- **THEN** the system SHALL deny access using the existing admin access controls

### Requirement: Admins can triage ideas
The system SHALL allow admins to move ideas between open, resolved, and ignored status without deleting the idea.

Feature: Admin ideas inbox

Rule: Triage SHALL preserve historical idea rows while changing the status shown to admins.

#### Scenario: Admin resolves an idea
- **GIVEN** an open idea exists
- **WHEN** an admin marks the idea as resolved
- **THEN** the system SHALL update the idea status to `resolved`
- **AND** the idea SHALL remain visible on the ideas page outside the primary open list

#### Scenario: Admin ignores an idea
- **GIVEN** an open idea exists
- **WHEN** an admin marks the idea as ignored
- **THEN** the system SHALL update the idea status to `ignored`
- **AND** the idea SHALL remain visible on the ideas page outside the primary open list

#### Scenario: Admin reopens a triaged idea
- **GIVEN** a resolved or ignored idea exists
- **WHEN** an admin marks the idea as open
- **THEN** the system SHALL update the idea status to `open`
- **AND** the idea SHALL return to the primary open list

### Requirement: Next-season seed idea exists
The system SHALL seed the requested next-season time-penalties question idea exactly once.

Feature: Admin ideas inbox

Rule: Seeded ideas SHALL be idempotent across app restarts.

#### Scenario: Seeded time penalties idea appears
- **GIVEN** the application starts with no existing seeded time-penalties idea
- **WHEN** an admin opens the ideas page
- **THEN** the page SHALL show an open question idea titled `Voorspel de totale hoeveelheid time penalties die in het seizoen uitgedeeld worden.`

#### Scenario: Seed does not duplicate
- **GIVEN** the seeded time-penalties idea already exists
- **WHEN** the application startup logic runs again
- **THEN** the system SHALL not create a duplicate seeded idea
