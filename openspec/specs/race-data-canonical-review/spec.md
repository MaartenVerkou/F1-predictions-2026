# race-data-canonical-review Specification

## Purpose
TBD - created by archiving change race-data-canonical-review-workspace. Update Purpose after archive.
## Requirements
### Requirement: Persisted race evidence is the canonical source

The system SHALL persist normalized, season- and round-scoped race evidence before rendering or deriving any question answer. Evidence SHALL cover the available race classification and status, starting grid, qualifying, sprint, fastest-lap or pole indicators, constructor results, and optional provider-specific facts such as destructors costs. Each bundle SHALL retain source/provenance metadata and explicit unresolved or unavailable states.

#### Scenario: Completed round becomes reviewable evidence
- **GIVEN** an approved provider returns a completed round
- **WHEN** the import is accepted
- **THEN** the system SHALL persist one identifiable evidence revision for that season and round
- **AND** the Race Data workspace SHALL render its finish-order facts from that persisted revision

#### Scenario: Evidence is incomplete
- **GIVEN** a provider omits a session or fact
- **WHEN** the evidence bundle is persisted
- **THEN** the missing fact SHALL be represented as unavailable or unresolved
- **AND** the system SHALL not replace it with a guessed zero or a synthetic result

### Requirement: Race Data has stable fact and metric views

The system SHALL provide Season and Round as the only global selectors at the top of the Race Data workspace. The first table SHALL always show the selected round's race result in finish order. Below it, the workspace SHALL provide shared Drivers/Constructors controls and reusable metric modes, including points, DNFs, podiums, qualifying, sprint, and other supported question evidence. Changing a view SHALL change the read model and totals without changing the persisted evidence.

#### Scenario: Admin opens a round
- **WHEN** an admin selects a season and round
- **THEN** the workspace SHALL show the race-result table first in finish order
- **AND** the driver and constructor championship tables SHALL follow below it
- **AND** the controls SHALL remain aligned and usable at narrow widths

#### Scenario: Admin changes a metric mode
- **GIVEN** the selected evidence supports the requested metric
- **WHEN** an admin selects Drivers, Constructors, or a metric mode such as DNFs or podiums
- **THEN** the same shared table structure SHALL render the corresponding values and totals
- **AND** the persisted evidence SHALL remain unchanged

### Requirement: Evidence corrections are protected and revisioned

The system SHALL expose evidence editing only to authorized admins through an explicit protected edit action. A correction SHALL require confirmation and a reason, SHALL create a new evidence revision linked to the prior revision, and SHALL leave participant responses and unrelated rounds untouched.

#### Scenario: Admin corrects a race fact
- **GIVEN** an admin identifies an incorrect persisted race fact
- **WHEN** the admin confirms a correction with a reason
- **THEN** the system SHALL save a new revision for the affected season and round
- **AND** the prior revision SHALL remain auditable
- **AND** the correction SHALL be available to derivation review without silently publishing a new score

#### Scenario: Non-admin attempts an edit
- **WHEN** a non-admin submits an evidence correction
- **THEN** the system SHALL reject the mutation
- **AND** the persisted evidence and participant responses SHALL remain unchanged

### Requirement: Evidence revisions are reproducible

The system SHALL retain the evidence revision, catalog revision, derivation version, editor, timestamp, and correction reason used by every derived or published result. Historical review and scoring SHALL be able to select the exact revision that was approved.

#### Scenario: Historical result is reopened
- **GIVEN** a round has a later corrected evidence revision
- **WHEN** an admin opens the earlier published result
- **THEN** the system SHALL identify the evidence and derivation revisions used by that result
- **AND** it SHALL not silently replace the historical result with the latest revision

