## Purpose

Define a small, explicit source policy so each fact has one canonical provider, while unique data such as destructors costs remains auditable without introducing duplicate race-result pipelines.

## ADDED Requirements

### Requirement: Provider ownership is non-overlapping

The system SHALL use OpenF1 as the canonical provider for official session results and starting grids, Jolpica/Ergast only for championship standings and existing Driver of the Day awards that OpenF1 does not provide, and the approved destructors source only for crash-component costs.

#### Scenario: A standard session import runs

- **WHEN** an import requests practice, sprint qualifying, qualifying, sprint, grid, or race facts
- **THEN** it SHALL use OpenF1
- **AND** it SHALL not select Formula 1 Dashboard or Jolpica as a competing standard-session provider

#### Scenario: A standings import runs

- **WHEN** an import requests driver or constructor championship standings by round
- **THEN** it SHALL use the configured standings source and record its provenance
- **AND** session-result imports SHALL not silently replace official standings without a comparison

#### Scenario: A destructors import runs

- **WHEN** an import requests crash-component costs
- **THEN** it SHALL use the approved destructors source and keep those rows separate from official session results
- **AND** the source SHALL be reviewed before affecting Actuals

### Requirement: Unsupported provider modes fail clearly

The system SHALL reject the generic Formula 1 Dashboard provider mode for standard race evidence after migration, with an actionable message naming the supported provider policy.

#### Scenario: A legacy Formula 1 Dashboard configuration is present

- **WHEN** an import starts with Formula 1 Dashboard configured as the standard-results provider
- **THEN** the import SHALL fail before writing evidence
- **AND** it SHALL instruct the operator to use the canonical OpenF1 session provider

### Requirement: Provenance and conflict handling are explicit

Every imported fact SHALL retain provider, provider schema, endpoint/session identity, fetch time, parser revision, and normalized payload revision. Conflicting providers SHALL remain separately inspectable until an administrator resolves the conflict.

#### Scenario: Providers disagree on a race result

- **WHEN** OpenF1 and a comparison source disagree for the same driver and session
- **THEN** the system SHALL show the disagreement with both sources
- **AND** no provider result SHALL be converted to zero or silently discarded

### Requirement: Rendering and scoring never call providers

Race Data, Actuals, participant response handling, leaderboard, and scoring SHALL read persisted evidence and reviewed snapshots only.

#### Scenario: An external provider is offline during page rendering

- **WHEN** an administrator or participant opens a page
- **THEN** the page SHALL render from the last persisted state
- **AND** provider availability SHALL not change already reviewed answers or scores
