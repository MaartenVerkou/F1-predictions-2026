## MODIFIED Requirements

### Requirement: Leaderboard shows latest-race movement
The system SHALL show compact latest-race rank movement in leaderboard rows when at least two valid actual snapshots are available for the configured season, and SHALL make meaningful movers more prominent than unchanged rows.

Feature: Leaderboard insights

Rule: Latest-race movement SHALL compare the latest valid actual snapshot with the immediately previous valid actual snapshot.

#### Scenario: Latest-race movement shows rank change in rows
- **GIVEN** a leaderboard has valid snapshots for two or more completed rounds
- **WHEN** a participant opens the leaderboard
- **THEN** the system SHALL show the latest-race rank change in the leaderboard rows
- **AND** positive and negative movement SHALL use compact signed values such as `+2` or `-3`
- **AND** unchanged rows SHALL not show `0` as equally prominent mover text

#### Scenario: Latest-race movement column stays compact
- **GIVEN** a leaderboard has latest-race movement data
- **WHEN** the leaderboard table is rendered
- **THEN** the movement column SHALL use a narrow visual footprint
- **AND** the column SHALL preserve an accessible label for assistive technology

#### Scenario: Selected participant shows point-change detail
- **GIVEN** a participant gains points between the latest valid snapshot and previous valid snapshot
- **WHEN** that participant is selected
- **THEN** the selected participant panel SHALL show the points gained since the previous valid snapshot
- **AND** it SHALL show the rank movement label as supporting context

### Requirement: Leaderboard presentation adapts to viewport and theme
The system SHALL present leaderboard insights, ranking, and selected-participant context without incoherent overlap or theme contrast regressions on supported desktop and phone layouts.

Feature: Leaderboard insights

Rule: Leaderboard presentation SHALL remain usable in light and dark mode.

#### Scenario: Desktop leaderboard uses available space cleanly
- **GIVEN** a user or visitor opens the global leaderboard on a desktop viewport
- **WHEN** the leaderboard renders in light or dark mode
- **THEN** the chart, ranking table, selected insight panel, and breakdown or sign-in prompt SHALL remain visible without page-level horizontal overflow
- **AND** selected/current participant emphasis SHALL remain distinguishable from ordinary chart lines and rows
- **AND** the ranking table SHALL use the primary content width before selected participant details are shown

#### Scenario: Selected details follow the ranking table
- **GIVEN** a participant is selected on a desktop leaderboard
- **WHEN** the leaderboard renders
- **THEN** selected participant details SHALL appear below the ranking table rather than beside it
- **AND** the selected details SHALL avoid heavy nested card treatment inside the leaderboard surface

#### Scenario: Phone leaderboard remains readable
- **GIVEN** a user or visitor opens the global leaderboard on a phone-width viewport
- **WHEN** the leaderboard renders in light or dark mode
- **THEN** the page SHALL stack the chart, ranking table, and selected insight panel in a readable order
- **AND** table columns, legend items, and action controls SHALL not overlap or truncate essential labels incoherently
