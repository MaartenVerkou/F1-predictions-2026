## ADDED Requirements

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

#### Scenario: Phone leaderboard remains readable
- **GIVEN** a user or visitor opens the global leaderboard on a phone-width viewport
- **WHEN** the leaderboard renders in light or dark mode
- **THEN** the page SHALL stack the chart, ranking table, and selected insight panel in a readable order
- **AND** table columns, legend items, and action controls SHALL not overlap or truncate essential labels incoherently
