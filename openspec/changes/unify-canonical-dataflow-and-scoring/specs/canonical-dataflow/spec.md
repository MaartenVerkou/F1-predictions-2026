## Purpose

Define the canonical season catalog and readiness contract that keeps identities, labels, memberships, and historical context consistent across every downstream workflow.

## ADDED Requirements

### Requirement: Downstream workflows use one resolved season catalog
Every Questions, Race data, Actuals, leaderboard, and scoring workflow SHALL resolve its drivers, teams, races, season memberships, seat assignments, aliases, and provider references from the same season-scoped canonical catalog.

#### Scenario: A label is renamed in Inputs
- **WHEN** an administrator changes a canonical driver's or team's display label
- **THEN** later pages SHALL display the new label while stored answers, evidence, assignments, and snapshots continue to refer to the same canonical ID

#### Scenario: A season is selected
- **WHEN** an administrator or downstream workflow selects a season
- **THEN** all resolved entities and assignments SHALL be limited to that season and SHALL not fall back to another season's roster

### Requirement: Catalog readiness is explicit and blocking where semantics are unsafe
The system SHALL expose a season readiness result that checks identity uniqueness, valid memberships, non-overlapping seat periods, calendar integrity, provider mapping state, and question-option resolvability. Ambiguous or unresolved mappings SHALL be reported with actionable context and SHALL not be guessed.

#### Scenario: A provider name has two possible canonical matches
- **WHEN** readiness evaluates the season catalog
- **THEN** the mapping SHALL be reported as ambiguous
- **AND** derivation SHALL not choose a driver, team, or race automatically

#### Scenario: A seat period overlaps another assignment
- **WHEN** readiness evaluates lineup assignments
- **THEN** the season SHALL be marked not ready for affected round-dependent workflows
- **AND** the conflicting periods SHALL identify the team and seat that must be corrected

### Requirement: Catalog revisions are traceable
The system SHALL produce a stable revision identifier or fingerprint for each resolved season catalog and SHALL make that revision available to evidence imports, actual snapshots, and audit records.

#### Scenario: Inputs change after evidence was imported
- **WHEN** a canonical label, assignment, calendar field, or season-specific metadata changes
- **THEN** a new catalog revision SHALL be produced
- **AND** existing evidence and snapshots SHALL retain the revision that was used to create them

#### Scenario: Inputs are unchanged
- **WHEN** the catalog is resolved repeatedly without a semantic change
- **THEN** the revision identifier SHALL remain stable

### Requirement: Legacy values have an explicit compatibility boundary
The system SHALL read legacy display-value answers and provider labels only through canonical resolution and SHALL write new values as canonical references. A value that cannot be resolved uniquely SHALL remain visible as unresolved and SHALL not be silently rewritten.

#### Scenario: A legacy answer matches one canonical driver
- **WHEN** a stored answer contains the driver's old display label
- **THEN** reads SHALL resolve it to the canonical driver reference
- **AND** a subsequent write SHALL store the canonical reference

#### Scenario: A legacy answer matches no canonical entity
- **WHEN** a stored answer cannot be resolved
- **THEN** the answer SHALL remain unchanged for auditability
- **AND** scoring SHALL mark it unavailable rather than awarding a guessed result
