# leaderboard-insights Specification

## Purpose
TBD - created by archiving change enhance-leaderboard-insights. Update Purpose after archive.
## Requirements
### Requirement: Leaderboard shows historical point trends
The system SHALL show a points-over-time view for a leaderboard when at least two valid actual snapshots are available for the configured season.

Feature: Leaderboard insights

Rule: Historical trends SHALL use saved actual snapshots as race-round milestones.

#### Scenario: Chart uses actual snapshot rounds
- **GIVEN** a group leaderboard has scored responses
- **AND** the configured season has at least two valid actual snapshots
- **WHEN** a participant opens the leaderboard
- **THEN** the system SHALL show a chart with one milestone per valid actual snapshot round
- **AND** each plotted value SHALL represent the participant's total leaderboard points after that round

#### Scenario: Chart is hidden when history is insufficient
- **GIVEN** a group leaderboard has fewer than two valid actual snapshots
- **WHEN** a participant opens the leaderboard
- **THEN** the system SHALL not show an empty trend chart
- **AND** the system SHALL continue to show the existing ranked leaderboard and question breakdown controls

### Requirement: Leaderboard chart uses a focus set
The system SHALL choose chart participants from the current top 10 plus the logged-in participant and selected participant when either is outside the top 10.

Feature: Leaderboard insights

Rule: The chart focus set SHALL keep the most relevant participants visible without plotting the entire leaderboard by default.

#### Scenario: Current top 10 are plotted by default
- **GIVEN** a leaderboard has more than 10 scored participants
- **WHEN** a participant opens the leaderboard without selecting another participant
- **THEN** the chart SHALL include the current top 10 participants
- **AND** the chart SHALL use the currently viewed scoring state to determine those top 10 participants

#### Scenario: Logged-in participant is included outside top 10
- **GIVEN** the logged-in participant has a scored leaderboard row outside the current top 10
- **WHEN** the logged-in participant opens the leaderboard
- **THEN** the chart SHALL include the logged-in participant in addition to the current top 10
- **AND** the logged-in participant SHALL be visually emphasized relative to ordinary top-10 lines

#### Scenario: Selected participant remains visible
- **GIVEN** a participant selects a leaderboard participant outside the current top 10
- **WHEN** the chart is rendered
- **THEN** the chart SHALL include the selected participant in addition to the current top 10
- **AND** the selected participant SHALL be visually emphasized relative to ordinary top-10 lines

#### Scenario: Default selected participant is useful
- **GIVEN** the logged-in participant has a scored leaderboard row
- **WHEN** the logged-in participant opens the leaderboard without an explicit selection
- **THEN** the system SHALL treat the logged-in participant as the selected participant
- **AND** the insight panel SHALL describe the logged-in participant

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

### Requirement: Leaderboard explains the selected participant
The system SHALL provide an insight panel for the selected participant using question-level score differences and distinctive predictions.

Feature: Leaderboard insights

Rule: Insights SHALL compare the selected participant against nearby ranked participants rather than every participant by default.

#### Scenario: Non-leader compares against nearby participants above
- **GIVEN** the selected participant is not ranked first
- **WHEN** the leaderboard insight panel is rendered
- **THEN** the system SHALL compare the selected participant against ranked participants above them in the nearby comparison band
- **AND** the system SHALL identify the largest scored-question gaps where those participants are ahead
- **AND** the system SHALL identify the selected participant's strongest scored-question advantages within the nearby comparison band

#### Scenario: Leader compares against participants below
- **GIVEN** the selected participant is ranked first
- **WHEN** the leaderboard insight panel is rendered
- **THEN** the system SHALL compare the selected participant against nearby participants below them
- **AND** the system SHALL describe the scored-question advantages that separate the leader from that nearby band

#### Scenario: Distinctive predictions are called out
- **GIVEN** the selected participant has a prediction or scoring pattern that differs from most nearby comparison participants
- **WHEN** the leaderboard insight panel is rendered
- **THEN** the system SHALL call out that distinctive prediction or pattern when it materially explains the selected participant's score

#### Scenario: Insights avoid unsupported claims
- **GIVEN** there is not enough scored question data to explain a selected participant's position
- **WHEN** the leaderboard insight panel is rendered
- **THEN** the system SHALL show a neutral empty-state explanation
- **AND** the system SHALL not invent reasons that are not supported by scored question data

### Requirement: Selected participant breakdown defaults to scored questions
The system SHALL provide an expandable question breakdown for the selected participant that defaults to scored questions and can toggle to all questions.

Feature: Leaderboard insights

Rule: Question breakdown SHALL prioritize scored questions while preserving access to the full overview.

#### Scenario: Scored questions are shown by default
- **GIVEN** the selected participant has one or more scored questions
- **WHEN** the selected participant's expanded breakdown is opened
- **THEN** the system SHALL show scored questions by default
- **AND** each row SHALL show the question, selected participant prediction, actual outcome, and points scored

#### Scenario: User toggles to all questions
- **GIVEN** the selected participant's expanded breakdown is visible
- **WHEN** the user selects the all-questions option
- **THEN** the system SHALL show all leaderboard questions for the selected participant
- **AND** unscored questions SHALL remain distinguishable from scored questions

#### Scenario: Breakdown selection stays in sync
- **GIVEN** a user selects a different participant from the leaderboard or chart
- **WHEN** the selected participant changes
- **THEN** the insight panel and expanded breakdown SHALL update to that selected participant

### Requirement: Global leaderboard is publicly readable
The system SHALL allow anonymous visitors to view the global leaderboard while protecting private group leaderboards and detailed prediction breakdowns.

Feature: Leaderboard insights

Rule: Public access SHALL apply only to the global leaderboard.

#### Scenario: Anonymous visitor opens global leaderboard
- **GIVEN** leaderboard scoring is available
- **AND** the visitor is not logged in
- **WHEN** the visitor opens the global leaderboard
- **THEN** the system SHALL show the global leaderboard ranking
- **AND** it SHALL show public trend and selected-participant summary context
- **AND** it SHALL not redirect the visitor to login

#### Scenario: Anonymous visitor cannot view detailed prediction breakdown
- **GIVEN** the visitor is not logged in
- **WHEN** the visitor opens the global leaderboard
- **THEN** the system SHALL not show selected participant prediction breakdown rows
- **AND** it SHALL prompt the visitor to sign in for detailed prediction breakdowns

#### Scenario: Anonymous visitor cannot open private group leaderboard
- **GIVEN** the visitor is not logged in
- **WHEN** the visitor opens a private group leaderboard
- **THEN** the system SHALL require login before showing the private group leaderboard

### Requirement: Public global leaderboard entry points bypass login
The system SHALL link anonymous users directly to the public global leaderboard from public leaderboard entry points while preserving login requirements for protected leaderboard resources.

Feature: Leaderboard insights

Rule: Public global leaderboard navigation SHALL not send anonymous visitors through a login redirect.

#### Scenario: Anonymous visitor opens global leaderboard from home preview
- **GIVEN** leaderboard scoring is available
- **AND** the visitor is not logged in
- **AND** the home page shows a global leaderboard preview
- **WHEN** the visitor follows the full global leaderboard link
- **THEN** the system SHALL open `/global/leaderboard`
- **AND** it SHALL show the global leaderboard ranking
- **AND** it SHALL not show the login form

#### Scenario: Protected leaderboard resources still require login
- **GIVEN** the visitor is not logged in
- **WHEN** the visitor opens a private group leaderboard
- **THEN** the system SHALL require login before showing that private group leaderboard

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
- **AND** the chart legend rail SHALL use bounded content-aware width rather than reserving a large fixed name column
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

#### Scenario: Chart scale focuses on current standings
- **GIVEN** the points-over-rounds chart has plotted participants with current point totals above zero
- **WHEN** the chart renders
- **THEN** the chart Y-axis lower bound SHALL use a rounded value derived from the lowest latest point total in the plotted focus set
- **AND** the lower bound SHALL not default to zero unless the plotted current standings require it
- **AND** earlier historical points below the visible lower bound SHALL remain within the plot area at the baseline

#### Scenario: Selected snapshot round is marked in the chart
- **GIVEN** a leaderboard has two or more saved race snapshots
- **WHEN** the leaderboard renders a selected saved race snapshot
- **THEN** the chart SHALL show a subtle vertical marker at the selected race round
- **AND** the marker SHALL remain visually subordinate to participant trend lines

#### Scenario: Compact ranking headers avoid wasted space
- **GIVEN** a leaderboard has latest-race movement data
- **WHEN** the ranking table renders
- **THEN** the visible position header SHALL be `POS`
- **AND** the visible points header SHALL be `PTS`
- **AND** the movement column SHALL keep an accessible label without visible header text

#### Scenario: Default snapshot is the latest saved race
- **GIVEN** a leaderboard has saved race snapshots
- **WHEN** the leaderboard opens without an explicit snapshot filter
- **THEN** the leaderboard SHALL score against the latest saved race snapshot
- **AND** the snapshot selector SHALL show that latest race as selected
- **AND** the selector SHALL not include a separate `Current` option

#### Scenario: Historical snapshots show race movement
- **GIVEN** a leaderboard has saved snapshots for at least three race rounds
- **WHEN** the user selects a middle race snapshot
- **THEN** the movement column SHALL compare that selected race snapshot against the immediately previous saved race snapshot
- **AND** positive and negative rank movement SHALL use the same compact signed values as the latest race view

#### Scenario: Selected details sit beside ranking after trend
- **GIVEN** a participant is selected on a desktop leaderboard
- **WHEN** the leaderboard renders
- **THEN** selected participant details SHALL appear below the chart section beside the ranking table
- **AND** the ranking table SHALL use bounded content-aware width rather than forcing an equal share with selected details
- **AND** selected participant details SHALL receive the remaining horizontal space on wide screens
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

