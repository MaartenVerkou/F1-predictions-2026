## ADDED Requirements

### Requirement: Single-round source refresh is pending until reviewed

The actuals sync workflow SHALL support refreshing exactly one selected race round through the canonical provider pipeline. A successful refresh SHALL re-derive that round's actual snapshot, mark it pending review, and SHALL NOT publish it automatically or overwrite earlier evidence revisions.

#### Scenario: Refreshed evidence changes a round answer
- **GIVEN** a round has an existing provider or admin-correction revision
- **WHEN** a source refresh produces different evidence or derived values
- **THEN** the system SHALL store the new provider revision and derived snapshot
- **AND** the derived snapshot SHALL be pending review
- **AND** the previously stored revision SHALL remain available in revision history

#### Scenario: Refreshed evidence is unchanged
- **GIVEN** a round has an existing revision
- **WHEN** a source refresh produces the same canonical evidence and answers
- **THEN** the system SHALL still record the provider fetch provenance
- **AND** it SHALL preserve the existing review history while leaving the selected derived snapshot pending review for explicit confirmation

#### Scenario: Provider failure leaves scoring unchanged
- **GIVEN** a source request fails or returns incomplete data that cannot form a valid round snapshot
- **WHEN** the single-round refresh finishes
- **THEN** no new evidence or actual snapshot SHALL be committed
- **AND** the currently published scoring values SHALL remain unchanged
