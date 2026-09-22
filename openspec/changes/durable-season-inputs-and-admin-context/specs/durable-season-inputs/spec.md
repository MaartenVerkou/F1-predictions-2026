## Purpose

Provides a durable, identity-safe model for using the same driver, team, race, and lineup data across current, future, and historical seasons.

## ADDED Requirements

### Requirement: Season context has an explicit lifecycle

The system SHALL expose each available season with its year, label, lifecycle status, and data availability, using `planned`, `active`, or `archived` semantics.

#### Scenario: Admin chooses an available season

- **WHEN** an admin opens a season-scoped workspace
- **THEN** the season control SHALL offer available seasons with human-readable labels and lifecycle status
- **AND** the selected season SHALL remain in the URL and all season-scoped navigation links

#### Scenario: Admin opens a season with no canonical data

- **WHEN** an admin selects a planned or unavailable season
- **THEN** the workspace SHALL show a clear preparation or empty state
- **AND** it SHALL not silently fall back to the active season

### Requirement: Canonical identity is separate from season membership and presentation

The system SHALL keep immutable driver and team identities separate from season membership, display labels, driver numbers, and team presentation order.

#### Scenario: A team or driver is renamed

- **WHEN** an admin changes a canonical display name or season override
- **THEN** existing references SHALL continue to resolve to the same canonical identity
- **AND** historical evidence and answers SHALL not be reassigned to a different entity

#### Scenario: A driver number changes

- **WHEN** a season-specific driver number is updated
- **THEN** the number SHALL change only the season presentation field
- **AND** canonical references and historical result identities SHALL remain unchanged

### Requirement: Driver seat membership is round-bounded

The system SHALL represent a driver's team and seat as an effective interval within a season, with at most one active team seat per driver and at most one driver per team seat for any round.

#### Scenario: A driver changes teams mid-season

- **WHEN** an admin applies a new lineup beginning at round N
- **THEN** the prior interval SHALL end at round N-1
- **AND** the new interval SHALL begin at round N
- **AND** projections before and after N SHALL resolve the correct team and seat

#### Scenario: A historical lineup is viewed

- **WHEN** an admin selects a past round
- **THEN** the displayed lineup SHALL use assignments effective at that round
- **AND** later replacements SHALL not rewrite the earlier projection

### Requirement: Historical and planned season edits are explicit

The system SHALL treat archived seasons as read-only by default and SHALL require an explicit historical or preparation action before mutating archived or planned season data.

#### Scenario: Archived season is opened

- **WHEN** an admin opens an archived season
- **THEN** the canonical tables SHALL remain viewable
- **AND** ordinary edit, reorder, and remove actions SHALL be disabled or require explicit confirmation

#### Scenario: Planned season is prepared

- **WHEN** an admin opens a planned season
- **THEN** the admin SHALL be able to prepare its calendar, memberships, order, and initial lineup without creating race evidence
- **AND** no active-season live scoring data SHALL be changed

### Requirement: External mappings remain explicit and auditable

The system SHALL resolve provider keys and source aliases to canonical entities through explicit mappings, and SHALL keep unresolved mappings visible without guessing.

#### Scenario: Provider row has a known mapping

- **WHEN** imported provider data contains a configured provider key or alias
- **THEN** it SHALL resolve to the configured canonical driver, team, or race identity

#### Scenario: Provider row has no safe mapping

- **WHEN** imported provider data cannot be mapped unambiguously
- **THEN** it SHALL remain unresolved and visible in the mapping queue
- **AND** it SHALL not be treated as a known entity or silent zero
