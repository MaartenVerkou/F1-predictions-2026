## ADDED Requirements

### Requirement: Shared admin controls have one compact presentation contract
Repeated admin segmented controls, compact selects, edit actions, and table toolbars SHALL use shared presentation classes and interaction states across Race Data, Questions, Results, and Season Inputs.

#### Scenario: Admin compares page toolbars
- **WHEN** an admin views the Race Data, Questions, Results, or Season Inputs toolbar
- **THEN** the control height, border treatment, active state, and spacing SHALL follow the same shared classes
- **AND** page templates SHALL not duplicate equivalent inline or page-specific control styles

### Requirement: Review metadata omits time from the visible audit label
The visible review metadata SHALL show the reviewer and calendar date without a time-of-day while retaining the full stored timestamp for audit purposes.

#### Scenario: A reviewed snapshot is displayed
- **WHEN** a reviewed race snapshot is shown in the Race Data toolbar
- **THEN** the visible label SHALL use the form `Reviewed by <reviewer> · <date>`
- **AND** it SHALL not display hours or minutes

### Requirement: Team input columns use shared compact identity geometry
The Season Inputs Teams table SHALL use the same centered compact index-column treatment as the Drivers table, provide more width to the team name, and keep Driver 1 and Driver 2 equal in width.

#### Scenario: Admin views Teams outside edit mode
- **WHEN** the Teams input table renders
- **THEN** the visible order number SHALL be centered in a narrow first column
- **AND** the team name column SHALL have more available width than either driver column
- **AND** Driver 1 and Driver 2 columns SHALL have equal widths
