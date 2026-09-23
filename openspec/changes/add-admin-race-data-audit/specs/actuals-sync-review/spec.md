## ADDED Requirements

### Requirement: Season sync persists source evidence before deriving actuals

The system SHALL create a named import batch and persist normalized source evidence for each available season round before calculating derived actual snapshots.

#### Scenario: Import then derive from persisted bundles

- **GIVEN** official or configured source data is available for a completed round
- **WHEN** an admin or scheduled process runs season sync
- **THEN** the system SHALL create an import batch with source, parser, lifecycle, and coverage metadata
- **AND** the system SHALL persist the normalized round bundle under that batch
- **AND** the derived actual calculation SHALL read the persisted bundles through the requested cutoff rather than the transient provider response
- **AND** the derived snapshot SHALL link to the import batch and exact round bundle

#### Scenario: Re-running unchanged values refreshes evidence without losing review state

- **GIVEN** a round has a reviewed snapshot and a later import derives the same actual values
- **WHEN** the later import completes
- **THEN** the system SHALL preserve the snapshot's reviewed status and review metadata
- **AND** the system SHALL associate the usable evidence from the later import with the unchanged derived values

#### Scenario: A source is incomplete or unavailable

- **GIVEN** one configured source feed is unavailable or contains no result for a round
- **WHEN** the import completes
- **THEN** the system SHALL record the missing/incomplete coverage state and import status
- **AND** the system SHALL not invent driver results, points, or statuses
- **AND** the derived calculation SHALL follow its existing missing-source behavior

#### Scenario: Historical evidence is reconstructed

- **GIVEN** a historical derived snapshot has no captured source bundle
- **WHEN** an administrator runs a historical reconstruction import
- **THEN** the import SHALL be marked reconstructed with a current fetched timestamp and source note
- **AND** the system SHALL not claim that the reconstruction is the original historical capture
- **AND** existing reviewed metadata SHALL remain unchanged when values do not change
