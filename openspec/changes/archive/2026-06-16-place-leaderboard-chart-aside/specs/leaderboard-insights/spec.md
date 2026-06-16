## MODIFIED Requirements

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
- **AND** the points-over-rounds chart SHALL appear beside the ranking table as a lighter companion panel on wide screens

#### Scenario: Selected details follow the ranking table
- **GIVEN** a participant is selected on a desktop leaderboard
- **WHEN** the leaderboard renders
- **THEN** selected participant details SHALL appear below the ranking table and chart row rather than beside the ranking table
- **AND** the selected details SHALL avoid heavy nested card treatment inside the leaderboard surface

#### Scenario: Phone leaderboard remains readable
- **GIVEN** a user or visitor opens the global leaderboard on a phone-width viewport
- **WHEN** the leaderboard renders in light or dark mode
- **THEN** the page SHALL stack the ranking table, chart, and selected insight panel in a readable order
- **AND** table columns, legend items, and action controls SHALL not overlap or truncate essential labels incoherently
