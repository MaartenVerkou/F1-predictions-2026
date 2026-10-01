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

### Requirement: Questions administration stays focused on question inputs
The Questions administration view SHALL render the global question inputs from the stable definition, localized metadata, and `question_settings`. It SHALL show only order, prompt, answer basis/type, derivation label, points, inclusion, and stable question identity; Actual lifecycle, catalog readiness, and downstream navigation SHALL not be duplicated here.

#### Scenario: An administrator opens Questions
- **WHEN** the Questions page is opened
- **THEN** it SHALL show one input table without a season selector or downstream-status columns
- **AND** the table SHALL preserve stable question IDs and the current persisted order

#### Scenario: An administrator edits question inputs
- **WHEN** the administrator presses the single Edit button
- **THEN** the same table SHALL switch to inline editing for order, prompt, points, and inclusion
- **AND** basis, type, and derivation metadata SHALL remain read-only

#### Scenario: An administrator saves question inputs
- **WHEN** Save is submitted
- **THEN** the system SHALL reject empty prompts, duplicate/out-of-range order values, and points overrides with the wrong shape
- **AND** one transaction SHALL persist the validated order, prompt override, points override, and inclusion values
- **AND** stable question IDs, derivation metadata, historical snapshots, and participant answers SHALL remain unchanged

#### Scenario: A prompt is customized
- **WHEN** a non-empty prompt override is saved for a question ID
- **THEN** the override SHALL be stored in `question_settings.prompt_override`
- **AND** all later question views SHALL use that prompt while continuing to resolve responses and scoring by the stable question ID

#### Scenario: Editing is cancelled
- **WHEN** the administrator presses Cancel before saving
- **THEN** no question setting SHALL be changed
