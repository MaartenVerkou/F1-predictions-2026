## MODIFIED Requirements

### Requirement: Admin can review one selected race result in a focused workspace

The system SHALL provide an admin-only Race Data review workspace with Season and Round selectors, a primary finish-order race-result table, and reusable driver/constructor metric views. The workspace SHALL include a separate question-linked derivation review control rather than changing the primary table implicitly whenever a question is selected.

#### Scenario: Admin selects a round
- **WHEN** an admin selects a season and round
- **THEN** the workspace SHALL show the race-result facts first in finish order
- **AND** it SHALL show the driver and constructor championship tables below the race-result section
- **AND** it SHALL keep the selected round visible without repeating redundant metadata

#### Scenario: Admin reviews a question derivation
- **GIVEN** an admin selects a question in the derivation review section
- **WHEN** the question is loaded
- **THEN** the system SHALL select the question's required driver or constructor metric view
- **AND** it SHALL show the corresponding evidence and derived interpretation
- **AND** it SHALL leave the primary fact-table navigation available

### Requirement: Review workspace shows answer context with interpreted results

The system SHALL show question context and the interpreted derived value in a dedicated derivation review section, while keeping the reusable Race Data tables available as the evidence context. The review section SHALL identify the selected evidence and derivation revisions and SHALL provide protected correction/review actions where permitted.

#### Scenario: Admin validates a selected derivation
- **GIVEN** an admin has selected a question and race round
- **WHEN** the derivation review section renders
- **THEN** it SHALL show the question's expected evidence metric and derived answer
- **AND** it SHALL link that result to the relevant Race Data view
- **AND** it SHALL provide the review or protected correction action without creating a duplicate table source
