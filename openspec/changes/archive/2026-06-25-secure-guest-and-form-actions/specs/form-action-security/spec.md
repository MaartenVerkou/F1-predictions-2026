## ADDED Requirements

### Requirement: Invite viewing is read-only
The system SHALL NOT create memberships or copy responses from GET invite routes.

#### Scenario: Authenticated visitor opens invite link
- **GIVEN** an authenticated user is not a member of an invited group
- **WHEN** the user opens the invite URL with a GET request
- **THEN** the system shows a confirmation path for joining
- **AND** the user is not added to the group

#### Scenario: Authenticated visitor opens invited questions URL
- **GIVEN** an authenticated user is not a member of an invited group
- **WHEN** the user opens the invited questions URL with a GET request
- **THEN** the system redirects to a confirmation or join path
- **AND** the user is not added to the group

### Requirement: Unsafe form actions require CSRF validation
The system SHALL reject unsafe browser form actions that do not include the current session CSRF token.

#### Scenario: Missing token is rejected
- **GIVEN** a user has an active session
- **WHEN** the user submits a POST form without a CSRF token
- **THEN** the system returns a forbidden response
- **AND** the requested state change is not applied

#### Scenario: Valid token allows form action
- **GIVEN** a user has an active session and a rendered form token
- **WHEN** the user submits a POST form with the matching CSRF token
- **THEN** the system processes the requested action according to the endpoint rules

### Requirement: Sensitive endpoints are throttled
The system SHALL rate-limit repeated authentication and password-style attempts from the same client context.

#### Scenario: Repeated login failures are throttled
- **GIVEN** a client repeatedly submits invalid login attempts
- **WHEN** the configured attempt threshold is exceeded
- **THEN** the system rejects additional attempts temporarily

#### Scenario: Repeated group password failures are throttled
- **GIVEN** a client repeatedly submits invalid group or guest join passwords
- **WHEN** the configured attempt threshold is exceeded
- **THEN** the system rejects additional attempts temporarily

