## Purpose

Give administrators one predictable place to inspect the season scoring model without adding scoring-rule detail to every unrelated input table.

## ADDED Requirements

### Requirement: Scoring rules have a dedicated Inputs sub-section
The Inputs workspace SHALL expose a dedicated “Scoring system” sub-section alongside Drivers, Teams, and Races. The scoring-rule overview SHALL render only when that sub-section is selected, and SHALL use the selected season as its context.

#### Scenario: Administrator opens a non-scoring input tab
- **GIVEN** an administrator opens Drivers, Teams, or Races in the Inputs workspace
- **WHEN** the page renders
- **THEN** the page SHALL show only the selected input workflow and its relevant tools
- **AND** the scoring-rule overview SHALL not be rendered as a competing section

#### Scenario: Administrator opens the scoring system sub-section
- **GIVEN** an administrator selects “Scoring system” for a season
- **WHEN** the page renders
- **THEN** it SHALL show the season’s scoring rules in the dedicated sub-section
- **AND** it SHALL preserve the season selector and Inputs navigation
- **AND** it SHALL present race and sprint scoring in a readable, labeled overview

#### Scenario: Scoring rules are unavailable for a season
- **GIVEN** the selected season has no configured scoring rules
- **WHEN** the scoring system sub-section renders
- **THEN** it SHALL show a clear empty state
- **AND** it SHALL not display rules from another season
