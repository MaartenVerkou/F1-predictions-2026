# question-definitions Specification

## Purpose
TBD - created by archiving change database-backed-question-definitions. Update Purpose after archive.
## Requirements
### Requirement: Definitions have one durable catalog

The system SHALL store each definition in a durable catalog with a stable key, display label, explanation, aliases, order, active state, and optional bindings to question IDs. A definition without a question binding SHALL be eligible for all supported question prompts; a bound definition SHALL only be eligible for the listed questions.

#### Scenario: Existing terminology is migrated
- **WHEN** the definitions catalog is first enabled
- **THEN** the existing DNF, DNS, DSQ, Grand Prix, podium, race-scope, grid-win, engine-team, damage, and lineup explanations SHALL be seeded without changing question IDs, stored answers, or scoring values

#### Scenario: Global and question-scoped definitions coexist
- **WHEN** a prompt contains a global alias and an alias belonging to a different question binding
- **THEN** the global term SHALL remain eligible
- **AND** the unrelated question-scoped term SHALL not be highlighted

### Requirement: Public definitions are discoverable

The system SHALL provide a public definitions page that lists the active definitions for the selected locale in a readable two-column term-and-explanation layout. The public Questions experience SHALL link to this page.

#### Scenario: Visitor opens definitions
- **WHEN** a visitor opens the public definitions page
- **THEN** the page SHALL render without authentication
- **AND** it SHALL show the active term labels and explanations in the selected locale

#### Scenario: Archived definitions are hidden publicly
- **WHEN** an administrator archives a definition
- **THEN** the definition SHALL no longer appear on the public page
- **AND** existing question answers SHALL remain unchanged

### Requirement: Questions and Responses share definition-aware tooltips

The system SHALL use the same definition catalog and matching behavior for term tooltips in public Questions and Responses views. Matching SHALL use configured aliases with safe word boundaries and SHALL escape rendered term labels and explanations.

#### Scenario: A bound term appears in its question
- **WHEN** a public question prompt contains an active alias eligible for that question
- **THEN** the alias SHALL be visibly marked and its configured explanation SHALL be available on hover and keyboard focus

#### Scenario: The explanation changes in admin
- **WHEN** an administrator updates an active definition explanation
- **THEN** subsequent Questions and Responses renders SHALL use the new explanation without a code change

#### Scenario: Unsupported or inactive aliases are present
- **WHEN** a prompt contains no eligible active alias
- **THEN** the prompt SHALL render as ordinary text without a stale or unrelated tooltip

### Requirement: Definitions cannot alter scoring semantics

Definition edits SHALL affect only labels, explanations, matching, and public presentation. They MUST NOT change derivation, scoring, race-data evidence, question IDs, or stored user answers.

#### Scenario: Definition text is edited
- **WHEN** an administrator changes a definition label or explanation
- **THEN** derived answers and points SHALL remain identical
- **AND** only the displayed glossary and tooltips SHALL change

