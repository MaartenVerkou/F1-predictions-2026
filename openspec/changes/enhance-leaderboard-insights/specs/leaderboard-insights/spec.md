## ADDED Requirements

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

### Requirement: Leaderboard shows round movers
The system SHALL show notable round movers when at least two valid actual snapshots are available for the configured season.

Feature: Leaderboard insights

Rule: Round movers SHALL compare the latest valid actual snapshot with the immediately previous valid actual snapshot.

#### Scenario: Latest round movers show points gained
- **GIVEN** a leaderboard has valid snapshots for two or more completed rounds
- **WHEN** a participant opens the leaderboard
- **THEN** the system SHALL show participants with notable points gained since the previous valid snapshot
- **AND** the system SHALL include rank movement as supporting context when rank changed

#### Scenario: Round movers handle unchanged ranks
- **GIVEN** a participant gains points between the latest valid snapshot and previous valid snapshot
- **AND** that participant's rank does not change
- **WHEN** round movers are shown
- **THEN** the system SHALL still be able to show the points gain
- **AND** the system SHALL avoid implying a rank movement occurred

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
