## ADDED Requirements

### Requirement: Race data review uses the selected season context

The Race data review workspace SHALL resolve evidence, calendar rounds, lineups, and summaries from the selected season context rather than silently using the configured active season.

#### Scenario: Admin reviews a past season

- **WHEN** an admin selects an archived season and opens Race data
- **THEN** the page SHALL show that season's calendar and evidence
- **AND** it SHALL not display current-season rounds as a fallback

#### Scenario: Admin selects a round in a planned season

- **WHEN** an admin selects a planned season round with no evidence
- **THEN** the page SHALL show the planned calendar state and an explicit no-evidence state
- **AND** it SHALL not invent a result or copy another season's data
