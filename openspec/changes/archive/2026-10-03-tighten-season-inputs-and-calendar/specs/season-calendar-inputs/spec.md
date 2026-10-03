## ADDED Requirements

### Requirement: Race inputs expose scheduled local start times

The system SHALL persist an optional scheduled start instant and IANA venue timezone for each season race and SHALL expose the local start time in the admin Races table when both values are available.

#### Scenario: Seeded race displays its published start

- **GIVEN** a race has a scheduled UTC instant and venue timezone
- **WHEN** an admin opens the season Races input view
- **THEN** the race row SHALL show the formatted local date and start time
- **AND** the displayed value SHALL identify the local-time context through its column or accessible metadata

#### Scenario: Unscheduled race remains editable

- **GIVEN** a race has no scheduled start instant
- **WHEN** an admin opens the season Races input view
- **THEN** the start column SHALL show an explicit empty value
- **AND** the race row SHALL remain available for normal editing

### Requirement: Calendar seeding is season-specific

The system SHALL load schedule metadata by season and race name, leaving scheduled fields nullable when a season has no published schedule entry.

#### Scenario: Existing round numbering is preserved

- **GIVEN** a season already has canonical race rounds and stored evidence
- **WHEN** schedule metadata is seeded
- **THEN** the seed SHALL update schedule fields by canonical race name
- **AND** it SHALL NOT insert or renumber rounds that are absent from the season's canonical race list
