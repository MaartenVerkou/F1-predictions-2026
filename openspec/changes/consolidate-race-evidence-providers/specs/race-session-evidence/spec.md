## Purpose

Provide one durable, provider-neutral evidence contract for every race-weekend session so historical backfills, Race Data review, Actuals derivation, and future imports use the same facts.

## ADDED Requirements

### Requirement: A round exposes every applicable session

The system SHALL represent each configured round's applicable Practice 1, Practice 2, Practice 3, Sprint Qualifying, Sprint, Grand Prix Qualifying, Starting Grid, and Race sessions with explicit availability and provenance.

#### Scenario: A normal weekend is complete

- **WHEN** a completed non-sprint round is imported
- **THEN** the evidence SHALL expose Practice 1, Practice 2, Practice 3, Grand Prix Qualifying, Starting Grid, and Race when the provider supplies them
- **AND** each available session SHALL contain normalized driver/team rows and its provider session identity

#### Scenario: A sprint weekend is complete

- **WHEN** a completed sprint round is imported
- **THEN** the evidence SHALL expose Practice 1, Sprint Qualifying, Sprint, Grand Prix Qualifying, Starting Grid, and Race when the provider supplies them
- **AND** the system SHALL distinguish Sprint Qualifying from Grand Prix Qualifying even when a provider uses the same session type for both

#### Scenario: A session is cancelled or unavailable

- **WHEN** a configured session is cancelled, not yet published, or absent from the provider
- **THEN** the session SHALL be marked cancelled or unavailable with a reason
- **AND** the system SHALL not create zero-valued rows or infer a result from another session

### Requirement: Session rows retain facts and identity

Every normalized session row SHALL preserve the canonical driver/team references when resolvable, provider identifiers, position/status semantics, relevant timing or points values, and the source session identity.

#### Scenario: A provider row contains a sentinel status

- **WHEN** a session result identifies a driver as DNF, DNS, DSQ, or another non-classified status
- **THEN** the normalized row SHALL retain that status and a null finishing position
- **AND** a sentinel SHALL never be treated as a numeric result

#### Scenario: A replacement driver is not in the catalog

- **WHEN** a provider driver cannot be uniquely mapped to the selected season catalog
- **THEN** the row SHALL remain visible with provider label and an unresolved reason
- **AND** affected derivations SHALL be unavailable until the mapping is corrected

### Requirement: Historical session backfill is reconstructive and idempotent

The system SHALL support a dry-run and an explicit apply operation for completed rounds. A historical import SHALL be marked reconstructed, retain the provider fetch time and session dates, and preserve the previous effective revision.

#### Scenario: The same session is backfilled twice

- **WHEN** the provider session key, normalized payload revision, and parser version are unchanged
- **THEN** the import SHALL reuse the effective evidence or create no duplicate session facts
- **AND** existing review and publication state SHALL remain unchanged

#### Scenario: A backfill conflicts with existing evidence

- **WHEN** a newly imported fact differs from the current effective fact for the same round, entity, or session
- **THEN** the system SHALL create a new pending evidence revision and report both provenance references
- **AND** it SHALL not silently overwrite reviewed or published Actuals

### Requirement: Future sync imports completed sessions only

The system SHALL import a future session only after its result is available or its cancellation is confirmed, and SHALL keep incomplete sessions visible without affecting scoring.

#### Scenario: A session result becomes available after a race

- **WHEN** a scheduled sync observes a completed provider session with a new payload revision
- **THEN** it SHALL persist the session revision and link it to the round evidence
- **AND** it SHALL trigger pending re-derivation for affected questions without publishing automatically

#### Scenario: A provider is temporarily unavailable

- **WHEN** a sync request fails or returns malformed data
- **THEN** the current effective evidence SHALL remain intact
- **AND** the import SHALL record an actionable error and retry state rather than fabricate data
