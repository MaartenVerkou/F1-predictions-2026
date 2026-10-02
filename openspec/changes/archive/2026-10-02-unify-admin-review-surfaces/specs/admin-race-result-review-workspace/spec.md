## MODIFIED Requirements

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
- **AND** no redundant visible content label SHALL consume toolbar space

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
