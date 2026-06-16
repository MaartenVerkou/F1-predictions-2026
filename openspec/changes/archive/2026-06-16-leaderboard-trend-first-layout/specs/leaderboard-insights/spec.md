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
- **AND** the points-over-rounds chart SHALL be the first major leaderboard section
- **AND** the chart legend SHALL appear beside the chart as a compact participant rail on wide screens
- **AND** the chart area SHALL avoid visible explanatory copy that repeats obvious scope or latest-round metadata
- **AND** the ranking table and selected participant details SHALL appear below the chart section on wide screens

#### Scenario: Chart legend selects participants and controls plotted series
- **GIVEN** the points-over-rounds chart has plotted participants
- **WHEN** the leaderboard renders
- **THEN** each legend item SHALL show only a checkbox, curve swatch, and participant name
- **AND** hovering a participant legend item SHALL subtly emphasize that legend item and its plotted curve
- **AND** clicking a participant legend item outside its checkbox SHALL select that participant without a full page reload
- **AND** unchecking a participant checkbox SHALL hide only that participant's plotted line and points
- **AND** rechecking the participant checkbox SHALL show that participant's plotted line and points again

#### Scenario: Compact ranking headers avoid wasted space
- **GIVEN** a leaderboard has latest-race movement data
- **WHEN** the ranking table renders
- **THEN** the visible position header SHALL be `POS`
- **AND** the visible points header SHALL be `PTS`
- **AND** the movement column SHALL keep an accessible label without visible header text

#### Scenario: Selected details sit beside ranking after trend
- **GIVEN** a participant is selected on a desktop leaderboard
- **WHEN** the leaderboard renders
- **THEN** selected participant details SHALL appear below the chart section beside the ranking table
- **AND** the ranking table and selected details SHALL receive roughly equal horizontal space
- **AND** the selected details SHALL avoid heavy nested card treatment inside the leaderboard surface

#### Scenario: Selected details stay scan-first
- **GIVEN** a selected participant has scored-question gaps, strengths, or distinctive picks
- **WHEN** the selected detail panel renders
- **THEN** first-glance insight rows SHALL use compact question identifiers such as `Q4` and point values instead of full question prompt text
- **AND** the panel SHALL avoid repeating per-row labels that duplicate the section heading meaning
- **AND** latest race and rank movement SHALL be shown inline rather than in large card blocks
- **AND** each populated insight section SHALL include a concise summary sentence that aggregates the visible rows and names the selected participant where useful
- **AND** the full question prompt SHALL remain available through hover or focus disclosure on the question identifier
- **AND** selected detail typography SHALL remain visually subordinate to the main leaderboard title and chart

#### Scenario: Phone leaderboard remains readable
- **GIVEN** a user or visitor opens the global leaderboard on a phone-width viewport
- **WHEN** the leaderboard renders in light or dark mode
- **THEN** the page SHALL stack the chart, legend controls, ranking table, and selected insight panel in a readable order
- **AND** table columns, legend items, and action controls SHALL not overlap or truncate essential labels incoherently
