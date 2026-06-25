## ADDED Requirements

### Requirement: Named guests require private resume credentials
The system SHALL prevent returning named guest access from being granted by display name alone.

#### Scenario: Public group guest cannot be resumed by name alone
- **GIVEN** a public invited group has an existing named guest with submitted answers
- **WHEN** another browser submits the returning guest form with only that guest display name
- **THEN** the system rejects returning guest access
- **AND** the existing guest answers remain associated with the original guest id

#### Scenario: Named guest receives a resume token after joining
- **GIVEN** an anonymous visitor joins an invited group as a named guest
- **WHEN** the guest join succeeds
- **THEN** the system associates a private resume token with that named guest
- **AND** the token is not stored in plaintext in the database

#### Scenario: Returning guest resumes with valid token
- **GIVEN** a named guest has a private resume token for an invited group
- **WHEN** the guest submits the returning guest form with the matching display name and token
- **THEN** the system grants access to the existing named guest
- **AND** future saved answers update that named guest's existing answers

### Requirement: Named guest session access remains scoped to the invited group
The system SHALL only allow named guest access when the session or resume token matches the requested invite and group.

#### Scenario: Guest token cannot be used for a different group
- **GIVEN** a named guest has a valid resume token for one invited group
- **WHEN** the guest submits that token against a different invited group
- **THEN** the system rejects returning guest access

