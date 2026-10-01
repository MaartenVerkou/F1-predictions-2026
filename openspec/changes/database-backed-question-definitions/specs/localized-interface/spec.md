## ADDED Requirements

### Requirement: Definitions follow the active locale

The definitions page and term tooltips SHALL render the label and explanation for the active locale. When a translation is unavailable, the system SHALL use the documented default locale without rendering an empty explanation or mixed placeholder text.

#### Scenario: A translated definition is available
- **GIVEN** a visitor selects a supported locale with a stored definition translation
- **WHEN** they view Definitions, Questions, or Responses
- **THEN** the term label and explanation SHALL use that locale

#### Scenario: A translation is missing
- **GIVEN** a definition has no translation for the active locale
- **WHEN** the page or tooltip is rendered
- **THEN** it SHALL use the default definition translation
- **AND** it SHALL remain readable and complete
