## MODIFIED Requirements

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
The Drivers/Constructors switch and the championship content-variant controls SHALL use the same segmented control styling and active-state semantics. When the available width cannot fit the variant buttons, the workspace SHALL provide a styled single-select control for the same choices without losing the current season, round, table view, or focus.

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
