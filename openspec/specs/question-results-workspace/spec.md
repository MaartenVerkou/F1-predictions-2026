# question-results-workspace Specification

## Purpose
TBD - created by archiving change merge-question-results-season-scope. Update Purpose after archive.
## Requirements
### Requirement: Questions and Results share one season-aware workspace

The admin interface SHALL expose a shared Questions & Results workspace with a season selector and a segmented view switch containing `Questions` and `Results`. The selected season SHALL be reflected in both views, and the active view SHALL be preserved in a stable URL state.

#### Scenario: An admin switches from Questions to Results
- **GIVEN** an admin is viewing the Questions view for season 2027
- **WHEN** the admin selects Results
- **THEN** the page SHALL stay in the same workspace and show the 2027 derived question results
- **AND** the season selector SHALL remain 2027
- **AND** the URL SHALL identify the Results view so it can be bookmarked or refreshed

#### Scenario: An admin selects another season
- **GIVEN** the workspace is open in either view
- **WHEN** the admin selects a different available season
- **THEN** the active view SHALL remain selected
- **AND** the question set, result rows, and review links SHALL be resolved for the new season

### Requirement: Questions view remains the editable configuration surface

The Questions view SHALL show the selected season's question set and allow authorized inline editing of wording, order, scoring, and inclusion. It SHALL show read-only calculation contract metadata and SHALL not expose result values as editable fields.

#### Scenario: An admin edits question configuration
- **GIVEN** the Questions view is active
- **WHEN** the admin opens edit mode and changes a question or moves it with the order controls
- **THEN** the row order and editable values SHALL update in place
- **AND** saving SHALL persist only the selected season's settings

### Requirement: Results view is a read-only derived overview

The Results view SHALL present one question-by-round matrix for the selected season, using the shared bounded value projection and review markers. Result cells SHALL link to the relevant Race Data view and SHALL not provide a second answer-editing workflow.

#### Scenario: A result cell needs source review
- **GIVEN** a selected season has a pending round snapshot
- **WHEN** the Results view renders
- **THEN** the round header SHALL show one compact review marker
- **AND** the question row SHALL link to the corresponding Race Data evidence view
- **AND** correcting source evidence SHALL remain a Race Data action

#### Scenario: No result has been published yet
- **GIVEN** the selected season has no published derived snapshot
- **WHEN** the Results view renders
- **THEN** it SHALL show a concise empty state explaining that Race Data review is required
- **AND** it SHALL not invent answer values

### Requirement: Existing entry points remain compatible

The system SHALL keep existing `/admin/questions` and `/admin/actuals` links usable. They SHALL open the corresponding Questions or Results view in the shared workspace without losing season, focus, or review context that can be represented by the new URL state.

#### Scenario: An existing Actuals bookmark is opened
- **GIVEN** an admin opens an existing `/admin/actuals?season=2026` bookmark
- **WHEN** the request is handled
- **THEN** it SHALL show the shared workspace in the Results view for 2026
- **AND** no data or review state SHALL be changed by the compatibility entry point

#### Scenario: An existing Questions edit bookmark is opened
- **GIVEN** an admin opens `/admin/questions?mode=edit&season=2027`
- **WHEN** the request is handled
- **THEN** it SHALL show the shared workspace in the Questions edit view for 2027
- **AND** the selected season's settings SHALL be loaded

### Requirement: User-facing terminology distinguishes configuration from results

The shared workspace SHALL use `Results` or `Question results` as the user-facing label for derived answers. The internal `actuals` route and storage terminology MAY remain for compatibility, but the UI SHALL not require administrators to understand that internal term.

#### Scenario: The admin navigation renders
- **WHEN** an authenticated admin opens the admin navigation
- **THEN** it SHALL expose one Questions & Results entry or one clearly grouped entry
- **AND** it SHALL not present `Actuals` as the only explanation of the derived answer view

