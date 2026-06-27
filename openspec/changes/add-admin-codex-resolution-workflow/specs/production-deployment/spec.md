## ADDED Requirements

### Requirement: Admin-approved Codex candidates can deploy through the established path
Production deployment SHALL support admin-approved Codex deploy candidates without allowing Codex to mutate the live production checkout directly.

#### Scenario: Admin schedules a candidate for overnight deploy
- **GIVEN** a deploy candidate is linked to a validated resolution run
- **WHEN** an admin schedules the candidate for overnight deployment
- **THEN** the system SHALL record the candidate as scheduled
- **AND** deployment SHALL use the established Git-backed production deploy path at the scheduled window

#### Scenario: Immediate production deploy is unavailable in v1
- **GIVEN** a deploy candidate is linked to a validated resolution run
- **WHEN** an admin views deployment actions in v1
- **THEN** the system SHALL NOT expose an immediate production deploy action
- **AND** the admin SHALL be able to schedule the candidate for the supported overnight deployment path

#### Scenario: Candidate deploy is blocked by stale validation
- **GIVEN** a deploy candidate is no longer based on the current deployable base or has stale validation
- **WHEN** the scheduled or immediate deploy begins
- **THEN** the deploy SHALL be blocked
- **AND** the admin UI SHALL show that the candidate needs revalidation
