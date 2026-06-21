## ADDED Requirements

### Requirement: Admin mutations use shared form protection
The admin interface SHALL require the shared form action protection for state-changing admin mutations.

#### Scenario: Admin mutation without CSRF token is rejected
- **GIVEN** an admin has an active session
- **WHEN** an admin mutation request is submitted without the current CSRF token
- **THEN** the system rejects the request
- **AND** the admin mutation is not applied

#### Scenario: Admin mutation with CSRF token succeeds
- **GIVEN** an admin has an active session and a rendered form token
- **WHEN** the admin submits a valid mutation form with the matching token
- **THEN** the system applies the mutation according to the endpoint rules
