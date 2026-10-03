## Purpose

Defines the season-specific points contract used to calculate and explain driver and constructor championship totals from persisted race evidence.

## ADDED Requirements

### Requirement: Each season has an explicit scoring-rules revision
The system SHALL resolve one effective scoring-rules revision for every season and SHALL use that revision when deriving race, sprint, fastest-lap, and constructor points.

#### Scenario: A season uses its configured race and sprint rules
- **GIVEN** a season has a scoring-rules revision with race and sprint point tables
- **WHEN** championship totals are derived from persisted result rows
- **THEN** race rows SHALL receive points from the configured race table
- **AND** sprint rows SHALL receive points from the configured sprint table
- **AND** constructor totals SHALL equal the configured aggregation of their drivers' derived race and sprint points

#### Scenario: Different seasons use different scoring rules
- **GIVEN** two seasons have different scoring-rules revisions
- **WHEN** the same finishing positions are derived for both seasons
- **THEN** each season SHALL use its own effective revision
- **AND** no season SHALL inherit another season's point table implicitly

#### Scenario: A result cannot be scored without a valid rules revision
- **GIVEN** a season has no valid scoring-rules revision
- **WHEN** an import or derivation attempts to calculate championship points
- **THEN** the operation SHALL report the missing rules as an actionable error
- **AND** it SHALL not publish guessed championship totals

### Requirement: Admins can inspect the effective season scoring rules
The Inputs area SHALL provide a read-only scoring overview for the selected season that identifies the revision/source and shows race, sprint, fastest-lap eligibility, and constructor aggregation rules.

#### Scenario: Admin opens the scoring overview
- **GIVEN** an admin selects a season in Inputs
- **WHEN** the scoring overview renders
- **THEN** it SHALL show the effective revision/source for that season
- **AND** it SHALL show the points awarded by finishing position for race and sprint
- **AND** it SHALL show whether a fastest-lap bonus applies and its eligibility
- **AND** it SHALL show how constructor totals are aggregated

#### Scenario: Rules are unavailable for a planned season
- **GIVEN** a planned season has no configured scoring revision
- **WHEN** the scoring overview renders
- **THEN** it SHALL show a clear not-configured state
- **AND** it SHALL not present a default table as if it were authoritative
