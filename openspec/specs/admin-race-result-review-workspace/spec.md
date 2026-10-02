# admin-race-result-review-workspace Specification

## Purpose
Define the focused admin workspace used to validate interpreted race actuals before review.

## Requirements
### Requirement: Admin can review one selected race result in a focused workspace
The system SHALL provide an admin-only Season actuals review workspace with a single race selector and one compact selected-snapshot metadata/action line.

#### Scenario: Admin selects a pending race
- **GIVEN** an admin selects a race with a pending snapshot
- **WHEN** the Season actuals workspace renders
- **THEN** the workspace SHALL show that race as the selected snapshot
- **AND** it SHALL provide the existing action to mark the selected snapshot reviewed
- **AND** it SHALL not repeat a season-wide pending-count summary

### Requirement: Review workspace shows answer context with interpreted results
The system SHALL show the selected race's relevant question context and interpreted actual values together before the admin confirms its snapshot.

#### Scenario: Admin validates a selected snapshot
- **GIVEN** an admin has selected a race snapshot
- **WHEN** the review workspace renders
- **THEN** it SHALL show the selected snapshot's interpreted values
- **AND** it SHALL show the corresponding score-bearing question context for that race
- **AND** it SHALL provide the existing snapshot save and review actions for that same selected race

### Requirement: Compact identity presentation preserves discoverability
The primary evidence and championship tables SHALL show full canonical driver and constructor names whenever the available layout width can accommodate them. At responsive width thresholds, the identity columns SHALL switch to stable three-letter codes before the table becomes unusable; the table SHALL retain horizontal scrolling as a final fallback. The full canonical names SHALL remain available through an accessible label or tooltip. Compact presentation MUST NOT change identity, ordering, or correction targets.

#### Scenario: Admin reviews a spacious result table
- **GIVEN** the Race Data workspace is rendered at a width where the identity columns fit
- **WHEN** a driver or constructor cell is displayed
- **THEN** the visible cell SHALL show the full canonical name
- **AND** the cell SHALL retain the same canonical identity used by corrections and derivations

#### Scenario: Admin reviews a compact result table
- **GIVEN** the Race Data workspace is rendered at a width where full identity names would crowd the facts
- **WHEN** a driver or constructor cell is displayed
- **THEN** the visible identity MAY use its stable three-letter code
- **AND** the full canonical name SHALL remain discoverable on hover and to assistive technology
- **AND** selecting and correcting the row SHALL continue to target the canonical driver identity

### Requirement: Selected-round evidence exposes the available session sequence
The selected round's result table SHALL preserve finish-order rows and SHALL show only persisted session columns that have evidence for that round. The table SHALL use a stable order: race position, driver, constructor, available practice sessions, sprint qualifying and sprint race when applicable, Grand Prix qualifying, grid, status, and points. Finish positions SHALL be displayed as plain numeric positions; session headers MAY use concise labels such as P1, P2, P3, Sprint Q, Sprint, and Qualifying, with an accessible/full title describing the session.

#### Scenario: Admin reviews a normal weekend
- **GIVEN** the selected round has practice and Grand Prix qualifying evidence but no sprint evidence
- **WHEN** the result table renders
- **THEN** it SHALL show available P1/P2/P3 columns followed by Grand Prix qualifying, grid, status, and points
- **AND** it SHALL not show empty sprint columns
- **AND** the first position column SHALL show values such as `1`, `2`, and `3`, never `P1`, `P2`, or `P3`

#### Scenario: Admin reviews a sprint weekend
- **GIVEN** the selected round has sprint-format evidence
- **WHEN** the result table renders
- **THEN** it SHALL show the available practice column(s), Sprint Q, Sprint, Grand Prix qualifying, grid, status, and points in that order
- **AND** missing optional sessions SHALL be omitted rather than filled with invented values

### Requirement: Championship content controls share one compact interaction pattern
The Drivers/Constructors switch and the championship content-variant controls SHALL use the same segmented control styling and active-state semantics. When the available width cannot fit the variant buttons, the workspace SHALL provide a styled single-select control for the same choices without losing the current season, round, table view, or focus. The compact select SHALL not add a visible `Content` label when its options already identify the control.

#### Scenario: Admin changes the championship content variant
- **GIVEN** the championship table is visible
- **WHEN** the admin chooses another content variant
- **THEN** the active control SHALL be visually consistent with the Drivers/Constructors switch
- **AND** the selected table SHALL keep the current season and round context

#### Scenario: Admin uses a narrow viewport
- **GIVEN** the viewport cannot fit all championship variant buttons
- **WHEN** the championship toolbar renders
- **THEN** the variant buttons SHALL collapse to a styled select control
- **AND** the control SHALL remain keyboard accessible and preserve the selected focus

### Requirement: Constructor Results uses race-result evidence
The Constructors Results content variant SHALL present each constructor's two driver race-result rows using the same finish-position, podium-color, PF, and FL presentation semantics as Drivers Results. The Constructors Points variant SHALL remain the championship-points projection.

#### Scenario: Admin reviews constructor Results
- **GIVEN** the Constructors table is selected with the Results variant
- **WHEN** the table renders
- **THEN** each driver cell SHALL show the race finish result or the appropriate status value
- **AND** the top three finish values SHALL use the shared podium presentation
- **AND** PF/FL markers SHALL use the shared result marker presentation when present

#### Scenario: Admin reviews constructor Points
- **GIVEN** the Constructors table is selected with the Points variant
- **WHEN** the table renders
- **THEN** cells SHALL show championship points for the selected round
- **AND** the table SHALL not be treated as race-result evidence
