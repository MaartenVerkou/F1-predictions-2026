## ADDED Requirements

### Requirement: Race data and Actuals share one evidence and cutoff view
The admin Race data and Actuals workspaces SHALL use the same selected season, round cutoff, normalized evidence revision, catalog revision, coverage state, and derived snapshot identity for a review operation.

#### Scenario: An admin selects a round in Race data
- **WHEN** the admin opens the corresponding Actuals review for that round
- **THEN** the Actuals workspace SHALL show the same cutoff and source evidence identity
- **AND** it SHALL not re-fetch or independently reinterpret the provider payload

#### Scenario: Evidence is not ready for a selected round
- **WHEN** the selected round has missing, partial, or unresolved evidence
- **THEN** both workspaces SHALL show the same blocking or warning state
- **AND** the review action SHALL explain what must be resolved before publication

### Requirement: Review actions are separated from evidence inspection
The workspace SHALL distinguish immutable observed evidence from derived actual values and from an administrator's explicit correction, while keeping the source chain visible without duplicating large metadata blocks.

#### Scenario: An admin reviews a derived value
- **WHEN** the selected round contains a derived answer
- **THEN** the workspace SHALL show the interpreted value and its source chain
- **AND** marking the snapshot reviewed SHALL not alter the stored evidence

#### Scenario: An admin corrects a value
- **WHEN** the admin saves a correction
- **THEN** the correction SHALL be stored as an explicit override with audit metadata
- **AND** the original derived value SHALL remain recoverable
