## ADDED Requirements

### Requirement: Admin-approved Codex candidates can deploy through the established path
Production deployment SHALL support admin-approved Codex deploy candidates without allowing Codex to mutate the live production checkout directly.

#### Scenario: Admin schedules a candidate for overnight deploy
- **GIVEN** a deploy candidate is linked to a validated resolution run
- **WHEN** an admin schedules the candidate for overnight deployment
- **THEN** the system SHALL record the candidate as scheduled
- **AND** deployment SHALL use the established Git-backed production deploy path at the scheduled window

#### Scenario: Admin deploys a candidate immediately
- **GIVEN** a deploy candidate is linked to a validated resolution run
- **WHEN** an admin confirms immediate deployment
- **THEN** the system SHALL trigger the established production deploy path for the candidate ref
- **AND** the deploy record SHALL show the exact branch or commit ref

#### Scenario: Candidate deploy is blocked by stale validation
- **GIVEN** a deploy candidate is no longer based on the current deployable base or has stale validation
- **WHEN** the scheduled or immediate deploy begins
- **THEN** the deploy SHALL be blocked
- **AND** the admin UI SHALL show that the candidate needs revalidation
