## Purpose

Make derived Actuals a transparent review projection over canonical race evidence, with one compact race-by-question overview and an explicit publication gate for scoring.

## ADDED Requirements

### Requirement: Actuals are derived from selected race evidence

The system SHALL derive each question's actual value from the selected season's persisted evidence revision, question definition, canonical inputs, and round cutoff. Actuals SHALL not be accepted from transient provider responses or from a separate factual table.

#### Scenario: Question derivation is requested
- **GIVEN** a season has persisted evidence through a selected round
- **WHEN** the derivation service evaluates a question
- **THEN** it SHALL return the canonical value, the evidence revision, and derivation provenance
- **AND** it SHALL return an explicit unavailable reason when required evidence is missing

### Requirement: Admin Actuals shows a race-by-question overview

The Actuals admin page SHALL provide one compact table with question rows and race-round columns. Each cell SHALL show the derived actual state for that question and round, including pending, reviewed, published, corrected, or unavailable state without duplicating the full Race Data matrix.

#### Scenario: Admin reviews a season overview
- **WHEN** an admin opens Actuals for a season
- **THEN** the page SHALL show questions as rows and race rounds as columns
- **AND** each value SHALL correspond to the derivation from canonical evidence
- **AND** selecting a cell SHALL open the relevant evidence/derivation review context

### Requirement: Publication is the scoring boundary

The system SHALL allow only reviewed derived results to become the selected published actual set for a season. Scoring SHALL use that published set and SHALL never read a pending revision or transient provider data.

#### Scenario: Corrected derivation awaits review
- **GIVEN** an evidence correction changes a derived answer
- **WHEN** the system recalculates the affected question
- **THEN** the new result SHALL be pending review
- **AND** existing published scoring SHALL remain unchanged until an admin reviews and publishes it

#### Scenario: No reviewed result exists
- **GIVEN** a question has no reviewed derived result for the selected cutoff
- **WHEN** scoring is requested
- **THEN** the system SHALL report that the actual is unavailable
- **AND** it SHALL not infer a value from the latest unreviewed evidence
