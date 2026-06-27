## ADDED Requirements

### Requirement: Ideas expose linked resolution runs
The admin ideas inbox SHALL show Codex resolution-run state for ideas that have automation attempts.

#### Scenario: Idea shows latest resolution run
- **GIVEN** an idea has one or more linked resolution runs
- **WHEN** an authenticated admin views the ideas inbox
- **THEN** the idea row SHALL show the latest run status
- **AND** the idea row SHALL link to the latest run detail page

#### Scenario: Idea can start first resolution run
- **GIVEN** an open idea has no linked resolution runs
- **WHEN** an authenticated admin views the idea row
- **THEN** the row SHALL expose an action to start a Codex resolution run

#### Scenario: Idea history remains after triage
- **GIVEN** an idea has linked resolution runs
- **WHEN** the idea is marked resolved or ignored
- **THEN** the linked run history SHALL remain visible to admins
