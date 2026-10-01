## ADDED Requirements

### Requirement: Admin can manage definitions from Inputs

The admin interface SHALL expose a Definitions section alongside the existing Inputs sections. Authenticated administrators SHALL be able to view, add, edit, reorder, activate, and archive definitions and their locale-specific text and aliases.

#### Scenario: Admin opens Definitions
- **GIVEN** an authenticated administrator opens Inputs
- **WHEN** they select Definitions
- **THEN** the page SHALL show active and archived definitions with their scope and current order
- **AND** the page SHALL use the shared admin table and toolbar presentation

#### Scenario: Admin saves a definition
- **GIVEN** an administrator edits a definition with a unique key, valid label, explanation, and alias set
- **WHEN** they save the form with the shared mutation protection
- **THEN** the definition SHALL be persisted
- **AND** the next public render SHALL use the updated metadata

#### Scenario: Admin archives instead of deleting history
- **GIVEN** an existing definition is no longer needed
- **WHEN** an administrator archives it
- **THEN** it SHALL become inactive and disappear from public matching
- **AND** its stable key and audit history SHALL remain recoverable

#### Scenario: Invalid definition edits are rejected
- **GIVEN** an administrator submits a duplicate key, empty explanation, malformed alias, or missing form token
- **WHEN** the mutation is processed
- **THEN** the system SHALL reject the change with an actionable error
- **AND** the previous definition SHALL remain unchanged
