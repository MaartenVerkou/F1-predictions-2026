## Purpose

Define the safe boundary for importing Formula 1 Dashboard data into persisted race evidence without coupling page rendering, actual derivation, or scoring to a live external service.

## ADDED Requirements

### Requirement: Formula 1 Dashboard imports are provider-boundary operations
The system SHALL access Formula 1 Dashboard only from an explicit import/sync operation through a versioned adapter, configurable base URL, timeout, and bounded retry policy.

#### Scenario: A configured import requests a completed round
- **WHEN** an import selects Formula 1 Dashboard for a season and round
- **THEN** the adapter SHALL fetch the calendar, race classification, starting grid, qualifying, sprint (when present), driver standings, and constructor standings required for that round
- **AND** it SHALL persist normalized evidence before any actual value is derived

#### Scenario: A Race data or Actuals page is rendered
- **WHEN** an administrator or participant opens a page after an import
- **THEN** the page SHALL read the persisted evidence bundle
- **AND** it SHALL not call Formula 1 Dashboard or another live provider

### Requirement: Provider responses are validated and provenance-rich
Every accepted Formula 1 Dashboard response SHALL pass structural validation and SHALL retain its provider name, schema revision, endpoint URLs, fetch timestamp, payload revision, and provider identifiers in the evidence provenance.

#### Scenario: A response is malformed or incomplete
- **WHEN** a required response is not valid JSON, has the wrong shape, or omits a required completed-round session
- **THEN** the import SHALL fail or mark the bundle incomplete with an actionable reason
- **AND** it SHALL not fabricate positions, points, or statuses

#### Scenario: The provider uses sentinel values
- **WHEN** a provider row uses a sentinel position or completion status for DNF, DNS, DNQ, DSQ, or not classified
- **THEN** normalization SHALL preserve the status semantics and store a null finishing position rather than treating the sentinel as a real position

### Requirement: Canonical mapping is explicit and conflict-safe
The adapter SHALL resolve provider driver, team, and race labels/IDs through the selected season catalog and SHALL retain source labels and IDs. Unresolved or ambiguous matches SHALL be visible and SHALL block affected derivations rather than being guessed.

#### Scenario: A Formula 1 Dashboard constructor maps uniquely
- **WHEN** the provider constructor ID or label matches one canonical team in the selected season
- **THEN** evidence SHALL store the canonical team ID plus provider ID and label

#### Scenario: Formula 1 Dashboard and another source disagree
- **WHEN** two imported sources provide conflicting normalized facts for the same season, round, entity, or session
- **THEN** the evidence comparison SHALL report the conflict with both provenance references
- **AND** no source SHALL silently overwrite the other or become a zero-valued fact

### Requirement: Provider selection is deterministic and idempotent
Provider selection SHALL be server-configurable, recorded on each import, and stable for a given normalized payload and parser version. Repeating the same import SHALL not reset review/publication state or create a duplicate effective bundle.

#### Scenario: The same Formula 1 Dashboard payload is imported twice
- **WHEN** the provider, round, payload revision, and parser version are unchanged
- **THEN** the existing effective evidence SHALL be reused or linked
- **AND** any existing reviewed/published state SHALL remain unchanged

#### Scenario: A provider payload changes
- **WHEN** the normalized Formula 1 Dashboard payload or parser version changes
- **THEN** a new evidence revision and pending actual snapshot SHALL be created
- **AND** the previous revision SHALL remain available for audit/rollback

### Requirement: Actuals and scoring use persisted evidence only
Formula 1 Dashboard data SHALL influence Actuals only through the normalized persisted evidence and the existing review/publish lifecycle. Scoring SHALL consume the selected published actual snapshot and SHALL never use a live provider response.

#### Scenario: An imported constructor result is used by a question
- **WHEN** an administrator derives a constructor-based Actual from an imported round
- **THEN** the derived value SHALL reference the evidence revision and catalog revision used
- **AND** it SHALL remain pending until reviewed and published
