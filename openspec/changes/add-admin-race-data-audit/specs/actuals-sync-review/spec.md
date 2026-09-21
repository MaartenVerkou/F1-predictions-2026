## ADDED Requirements

### Requirement: Season sync retains source evidence for derived actuals

The system SHALL persist the normalized source evidence used to calculate each completed round's actual snapshot, including available race classification, status, grid, qualifying, sprint, standings, source metadata, and coverage state.

#### Scenario: Sync stores evidence beside a completed round snapshot

- **GIVEN** official or configured source data is available for a completed round
- **WHEN** an admin or scheduled process runs season sync
- **THEN** the system SHALL retain a source bundle associated with that round and sync result
- **AND** the source bundle SHALL be available to the admin Race data workspace
- **AND** the derived actual snapshot SHALL remain reviewable through the existing workflow

#### Scenario: Re-running unchanged values refreshes evidence without losing review state

- **GIVEN** a round has a reviewed snapshot and a later sync computes the same actual values
- **WHEN** the later sync stores source evidence
- **THEN** the system SHALL preserve the snapshot's reviewed status and review metadata
- **AND** the system SHALL associate the latest usable evidence with the unchanged derived values

#### Scenario: A source is incomplete or unavailable

- **GIVEN** one of the configured source feeds is unavailable or contains no result for a round
- **WHEN** season sync completes
- **THEN** the system SHALL record the missing or incomplete coverage state
- **AND** the system SHALL not invent driver results, points, or statuses
- **AND** the derived actual calculation SHALL continue to follow its existing missing-source behavior
