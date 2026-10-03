## Purpose

Allow each season to use its own question membership and editable presentation/scoring settings while preserving one stable catalog of question identities and answer references.

## ADDED Requirements

### Requirement: Each season has an explicit question set

The system SHALL resolve question inclusion and ordering in the context of a selected season. Every catalog question with a stable ID SHALL be available to a season configuration, and a season SHALL be able to exclude a catalog question without deleting its definition or stored answers.

#### Scenario: A new season uses the catalog defaults
- **GIVEN** a season has no explicit override for a catalog question
- **WHEN** the question set is loaded for that season
- **THEN** the question SHALL use its catalog prompt, scoring rule, and source contract
- **AND** it SHALL be included in the default catalog order

#### Scenario: An admin excludes a question for one season
- **GIVEN** a catalog question is included in season 2026
- **WHEN** an admin excludes that question in season 2027
- **THEN** the question SHALL be absent from the 2027 prediction and result views
- **AND** it SHALL remain available in the catalog and in 2026
- **AND** existing responses and historical scored results SHALL remain unchanged

#### Scenario: A catalog question is enabled for a later season
- **GIVEN** a catalog question exists but is excluded in a season
- **WHEN** an admin includes it for that season
- **THEN** it SHALL appear in that season's question order and result overview
- **AND** its stable question ID SHALL remain unchanged

### Requirement: Season question edits preserve the contract identity

The system SHALL allow an admin to edit a season's question order, prompt override, scoring override, and inclusion state without changing the stable question ID, answer references, derivation type, or evidence contract. The system SHALL validate that saved order values are unique and form a complete order for the included question set.

#### Scenario: An admin edits a season question set
- **GIVEN** an authenticated admin is editing the selected season's Questions view
- **WHEN** the admin saves wording, points, inclusion, or order changes
- **THEN** the changes SHALL apply only to that season
- **AND** the next load SHALL show the normalized order and effective scoring values
- **AND** contract metadata SHALL remain read-only

#### Scenario: Duplicate order values are submitted
- **GIVEN** two included questions receive the same order value
- **WHEN** the admin submits the edit form
- **THEN** the request SHALL be rejected with an actionable validation message
- **AND** no partial question-set change SHALL be persisted

#### Scenario: A non-admin attempts to change a question set
- **GIVEN** a request does not have admin authorization or a valid form token
- **WHEN** it submits a season question-set mutation
- **THEN** the system SHALL reject the mutation
- **AND** the season question set SHALL remain unchanged

### Requirement: Existing question settings migrate without changing history

The system SHALL migrate existing global question settings into the active season's initial configuration when season-scoped settings are introduced. The migration SHALL preserve effective inclusion, order, prompt overrides, and scoring overrides for that season and SHALL not rewrite stored responses, snapshots, published actuals, or leaderboard history.

#### Scenario: The application starts with legacy settings
- **GIVEN** the database contains global question settings but no season-specific settings
- **WHEN** the schema migration runs
- **THEN** the active season SHALL receive equivalent effective question settings
- **AND** the migration SHALL be idempotent on subsequent starts
- **AND** existing historical records SHALL remain byte-for-byte unchanged

### Requirement: Derivation and scoring use the selected season question set

The system SHALL use the selected season's included questions, effective prompts, and scoring overrides when generating prediction forms, deriving results, building the Results overview, and calculating leaderboard points. A historical snapshot SHALL retain the question values and scoring context that were used when it was created.

#### Scenario: Results are loaded for a season with a different question set
- **GIVEN** season 2027 excludes a question that is included in 2026
- **WHEN** an admin opens 2027 Results
- **THEN** the overview SHALL not render a row for the excluded question
- **AND** the 2026 overview SHALL still render its row

#### Scenario: A season scoring override is used
- **GIVEN** a question has different points configured for two seasons
- **WHEN** answers are scored in each season
- **THEN** each season SHALL use its own effective scoring rule
- **AND** recalculating a later season SHALL not change historical scores from the other season
