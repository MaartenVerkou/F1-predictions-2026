## Purpose

Define the durable path from provider race data to normalized evidence and derived actuals, with round cutoffs, provenance, idempotency, and safe handling of incomplete data.

## ADDED Requirements

### Requirement: Evidence is normalized and persisted before derivation
An import SHALL normalize provider payloads into an immutable, season- and round-scoped evidence bundle containing canonical entity references where resolved, source labels, source metadata, coverage state, and the selected cutoff context before any actuals are derived.

#### Scenario: A completed race is imported
- **WHEN** the provider returns race, qualifying, sprint, and standings data
- **THEN** the system SHALL persist the normalized evidence bundle first
- **AND** actual derivation SHALL reference that persisted bundle rather than an in-memory provider object

#### Scenario: One provider row cannot be mapped
- **WHEN** an evidence row has no unique canonical driver, team, or race mapping
- **THEN** the row SHALL retain its source label and unresolved state
- **AND** affected derived values SHALL be unavailable rather than fabricated

### Requirement: Equivalent imports are idempotent
The system SHALL identify equivalent source imports by season, round, source identity, payload revision, and parser version, and SHALL avoid creating duplicate effective evidence or changing review state when the normalized bundle is unchanged.

#### Scenario: The same source is synced twice
- **WHEN** a second sync produces the same normalized bundle and parser version
- **THEN** the system SHALL reuse or link to the existing effective evidence
- **AND** it SHALL not create a new pending actual snapshot solely because the sync was repeated

#### Scenario: The normalized result changes
- **WHEN** a new source payload or parser version changes normalized values
- **THEN** the system SHALL persist a new evidence revision
- **AND** any newly derived actual snapshot SHALL require review

### Requirement: Round cutoffs are consistent across evidence, actuals, and standings
For a selected round, every cumulative result SHALL include only evidence through that round and SHALL exclude future rounds, cancelled rounds without results, and untrusted incomplete rows according to their explicit coverage state.

#### Scenario: An administrator selects an earlier round
- **WHEN** Race data or Actuals is opened for round R8
- **THEN** driver and constructor totals, derived answers, and displayed evidence SHALL use the same R8 cutoff
- **AND** later rounds SHALL be visibly excluded or marked future

#### Scenario: A round is incomplete
- **WHEN** the selected evidence bundle is partial or missing required source coverage
- **THEN** the workspace SHALL show the coverage state
- **AND** derivation SHALL not silently convert missing facts into zero-valued facts

### Requirement: Derivations are versioned and explainable
Each derived actual value SHALL record the derivation version, catalog revision, evidence revision, and the input facts or unresolved reason needed to explain the result to an administrator.

#### Scenario: An admin inspects a derived actual
- **WHEN** an actual value is shown in the review workspace
- **THEN** the admin SHALL be able to identify the source evidence and derivation/catalog revisions used
- **AND** an unavailable value SHALL show why it could not be derived
