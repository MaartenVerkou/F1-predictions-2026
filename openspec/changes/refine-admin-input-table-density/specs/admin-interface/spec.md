## ADDED Requirements

### Requirement: Team metadata is scan-friendly

The team table SHALL present optional team metadata as short, human-readable tokens: team code, three-letter base country code, an unambiguous `since {year}` token, and an optional power-unit token. The metadata SHALL remain secondary to the team name and SHALL omit absent values without leaving placeholder separators.

#### Scenario: Team row shows compact metadata
- **GIVEN** a team has a code, base country, entry year, and power unit
- **WHEN** the teams table renders
- **THEN** the secondary line shows the code, country, `since {year}`, and a compact power-unit token
- **AND** it does not prefix the year with `F1`

#### Scenario: Missing metadata does not create noise
- **GIVEN** a team has only some optional metadata
- **WHEN** the teams table renders
- **THEN** only available tokens are shown
- **AND** the line contains no empty token or doubled separator

## MODIFIED Requirements

### Requirement: Admin pages fit supported viewports
The system SHALL render admin pages within supported phone and desktop viewports without page-level horizontal overflow, while keeping dense input tables readable through bounded table scrolling and responsive secondary content.

Feature: Admin interface

Rule: Admin pages SHALL avoid page-level horizontal overflow while preserving dense operational data.

#### Scenario: Season actuals fits on phone
- **GIVEN** an admin opens the Season actuals page on a phone-width viewport
- **WHEN** the page renders questions, target controls, review panels, and save controls
- **THEN** primary inputs and action controls SHALL fit within the viewport
- **AND** the page SHALL not create document-level horizontal scrolling
- **AND** DNF-per-race controls SHALL remain readable and operable

#### Scenario: Wide admin tables scroll inside their own region
- **GIVEN** an admin opens overview, detail, question settings, analysis, or input pages with wide tables
- **WHEN** the viewport is narrower than the table's useful minimum width
- **THEN** the table SHALL scroll horizontally inside a bounded table region
- **AND** the document itself SHALL not overflow horizontally
- **AND** long IDs, answers, names, metadata, and timestamps SHALL wrap or truncate within their cells instead of expanding the page

#### Scenario: Input tables preserve usable priority on narrow screens
- **GIVEN** an admin opens the drivers, teams, races, or mappings input table below its desktop width
- **WHEN** the viewport becomes narrow
- **THEN** the table SHALL keep primary names and actions visible
- **AND** secondary metadata SHALL wrap or truncate without changing the row's meaning
- **AND** row selection and inline editors SHALL remain reachable without overlapping controls

#### Scenario: Admin action rows wrap predictably
- **GIVEN** an admin page contains multiple links, forms, or buttons in the same action area
- **WHEN** the viewport is narrow
- **THEN** the action controls SHALL wrap or stack without overlapping
- **AND** destructive actions SHALL remain visibly separate from navigation actions
