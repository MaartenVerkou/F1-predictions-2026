# admin-interface Specification

## Purpose
TBD - created by archiving change polish-admin-responsive-locales. Update Purpose after archive.
## Requirements
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

### Requirement: Admin pages fit supported viewports
The system SHALL render admin pages within supported phone and desktop viewports without page-level horizontal overflow.

Feature: Admin interface

Rule: Admin pages SHALL avoid page-level horizontal overflow while preserving dense operational data.

#### Scenario: Season actuals fits on phone
- **GIVEN** an admin opens the Season actuals page on a phone-width viewport
- **WHEN** the page renders questions, target controls, review panels, and save controls
- **THEN** primary inputs and action controls SHALL fit within the viewport
- **AND** the page SHALL not create document-level horizontal scrolling
- **AND** DNF-per-race controls SHALL remain readable and operable

#### Scenario: Wide admin tables scroll inside their own region
- **GIVEN** an admin opens overview, detail, question settings, or analysis pages with wide tables
- **WHEN** the viewport is narrower than the table's useful minimum width
- **THEN** the table SHALL scroll horizontally inside a bounded table region
- **AND** the document itself SHALL not overflow horizontally
- **AND** long IDs, answers, and names SHALL wrap or truncate within their cells instead of expanding the page

#### Scenario: Dense race-data identity and summary columns fit content-aware widths
- **GIVEN** an admin opens the Race Data workspace on a phone-width viewport
- **WHEN** a driver or constructor table is rendered
- **THEN** identity and final summary columns SHALL use compact content-aware widths
- **AND** canonical names SHALL remain discoverable through the existing compact-label behavior
- **AND** more race/session columns SHALL be visible before horizontal scrolling is needed
- **AND** the final summary values SHALL remain visible and distinguishable

#### Scenario: Admin action rows wrap predictably
- **GIVEN** an admin page contains multiple links, forms, or buttons in the same action area
- **WHEN** the viewport is narrow
- **THEN** the action controls SHALL wrap or stack without overlapping
- **AND** destructive actions SHALL remain visibly separate from navigation actions

### Requirement: Admin layout uses reusable presentation classes

The system SHALL use shared presentation classes for repeated admin layout concerns and SHALL keep the Season inputs page compact without hiding applicable actions.

Feature: Admin interface

Rule: Shared admin layout concerns SHALL be expressed through reusable CSS classes rather than repeated inline styles. Season-input toolbars SHALL keep supported actions visible and use disabled state when a row selection is required.

#### Scenario: Inputs guidance does not duplicate the controls

- **GIVEN** an admin opens the Teams input view
- **WHEN** the team-period table renders
- **THEN** the visible layout SHALL not include a redundant instructional paragraph
- **AND** the period labels in the table SHALL remain readable

#### Scenario: Supported table actions remain discoverable

- **GIVEN** an admin opens Drivers, Teams, or Races inputs without selecting a row
- **WHEN** the table toolbar renders
- **THEN** each supported edit/remove action SHALL remain visible
- **AND** an action requiring selection SHALL be disabled

#### Scenario: Selecting a row enables its actions

- **GIVEN** an admin selects a row in a table with an edit or remove capability
- **WHEN** the selection state updates
- **THEN** the corresponding toolbar action SHALL become enabled
- **AND** the action SHALL operate on the selected row

### Requirement: Admin navigation exposes ideas inbox
The system SHALL expose the admin ideas inbox through the existing admin navigation.

Feature: Admin interface

Rule: Admin navigation SHALL include the ideas page without breaking existing admin layout behavior.

#### Scenario: Admin opens ideas from admin navigation
- **GIVEN** an authenticated admin is on an admin page
- **WHEN** the admin navigation renders
- **THEN** it SHALL include a link to the admin ideas page
- **AND** the ideas link SHALL show an active state when the admin is on the ideas page

#### Scenario: Admin ideas page fits supported viewports
- **GIVEN** an authenticated admin opens the ideas page on desktop or phone
- **WHEN** the page renders the create form and idea lists
- **THEN** the page SHALL avoid document-level horizontal overflow
- **AND** action controls SHALL wrap or stack without overlapping

### Requirement: Admin mutations use shared form protection
The admin interface SHALL require the shared form action protection for state-changing admin mutations.

Feature: Admin interface

Rule: Admin mutation forms SHALL participate in the shared unsafe-action protection layer.

#### Scenario: Admin mutation without CSRF token is rejected
- **GIVEN** an admin has an active session
- **WHEN** an admin mutation request is submitted without the current CSRF token
- **THEN** the system rejects the request
- **AND** the admin mutation is not applied

#### Scenario: Admin mutation with CSRF token succeeds
- **GIVEN** an admin has an active session and a rendered form token
- **WHEN** the admin submits a valid mutation form with the matching token
- **THEN** the system applies the mutation according to the endpoint rules

### Requirement: Season actuals review avoids duplicate operational summaries
The system SHALL present the Season actuals review state in one compact workspace rather than repeating selected snapshot status, sync metadata, no-snapshot instructions, and race-review counts in separate prominent panels.

#### Scenario: Admin opens Season actuals with review backlog
- **GIVEN** an authenticated admin opens the Season actuals page with one or more pending snapshots
- **WHEN** the page renders
- **THEN** it SHALL show one race selector followed by at most one selected-snapshot metadata/action line
- **AND** it SHALL not show a season-wide pending-count summary or repeat latest-sync metadata

### Requirement: Consistent table boundaries
All admin data tables MUST render a visually distinct header boundary and a clear boundary before the first data row, while preserving the existing responsive bounded-scroll behavior.

#### Scenario: Table has data
- **WHEN** an admin table renders one or more rows
- **THEN** the header has a visible bottom rule and the first data row is separated from the header without relying only on alternating row color

#### Scenario: Table is empty
- **WHEN** an admin table renders its empty state
- **THEN** the empty-state row uses the same table frame and header boundary as a populated table

### Requirement: Contextual admin feedback placement
Success, error, warning, and informational messages associated with a table MUST render in a dedicated context area above the table toolbar, and MUST NOT be inserted between toolbar controls and the table.

#### Scenario: Mutation returns feedback
- **WHEN** an admin page receives a mutation result or validation message for a table
- **THEN** the message is displayed above the toolbar with alert semantics and the toolbar remains adjacent to the table

#### Scenario: No feedback is present
- **WHEN** an admin page has no message to show
- **THEN** the context area does not reserve visible space or introduce an extra divider

### Requirement: Shared table rhythm
Inputs, Race data, Actuals, Overview, and Questions admin tables MUST use the shared table shell and spacing contract while retaining page-specific columns, controls, and capability flags.

#### Scenario: Compare admin tables
- **WHEN** an administrator navigates between supported admin pages
- **THEN** table headers, toolbar spacing, row boundaries, empty states, and horizontal overflow behave consistently

### Requirement: Drivers view separates identity from lineup relationships
The admin Inputs Drivers view SHALL show season driver number, driver name, optional short code, nationality, and derived age. It SHALL NOT show a derived Team column because team membership is time-bounded and managed in the Teams view.

#### Scenario: Drivers table presents compact profile context
- **GIVEN** an admin opens Drivers for a selected season
- **WHEN** the table renders
- **THEN** the columns are `#`, Driver, Code, Nationality, and Age
- **AND** the table contains no Team column

#### Scenario: Driver editor exposes profile fields
- **GIVEN** an admin selects a driver or adds a driver
- **WHEN** the driver editor opens
- **THEN** it offers name, season number, short code, nationality, and date of birth
- **AND** team assignment controls are absent

### Requirement: Admin navigation exposes the Race data audit workspace before Actuals

The system SHALL expose the admin-only Race data audit workspace through the existing admin navigation.

#### Scenario: Admin opens Race data from navigation

- **GIVEN** an authenticated admin is on an admin page
- **WHEN** the admin navigation renders
- **THEN** it SHALL include a Race data link before the Actuals link
- **AND** the Race data link SHALL show an active state when the Race data workspace is open

### Requirement: Inputs primary navigation focuses on canonical editing

The Inputs workspace SHALL make Drivers, Teams, and Races the primary season-scoped views, while derived assignment history and source mappings SHALL not compete with canonical editing in the main tab strip.

#### Scenario: Admin opens Inputs for a season

- **WHEN** the Inputs workspace renders
- **THEN** the primary navigation SHALL expose Drivers, Teams, and Races
- **AND** the selected season SHALL remain visible and preserved in each link

### Requirement: Assignment history remains available without being a primary editor

The system SHALL retain round-bounded driver/team assignments as the canonical historical relationship and SHALL expose them, when needed, through a read-only advanced history view or team detail workflow.

#### Scenario: Admin reviews a driver's team history

- **WHEN** an admin opens the advanced assignment history for a season
- **THEN** the view SHALL show driver, team, seat, and effective rounds
- **AND** it SHALL not present raw IDs or editable interval fields as the normal workflow
- **AND** normal lineup changes SHALL be performed from Teams

### Requirement: Source mappings are an attention queue

The system SHALL retain aliases and provider references for identity resolution while presenting unresolved or conflicting mappings as a conditional Data quality workflow.

#### Scenario: No unresolved mappings exist

- **WHEN** all source labels for the selected season resolve to canonical entities
- **THEN** the primary Inputs navigation SHALL not show an empty mapping editor
- **AND** the workspace SHALL communicate that source data is fully matched

#### Scenario: Unresolved mapping exists

- **WHEN** a source or provider mapping is unresolved or conflicting
- **THEN** the Inputs workspace SHALL expose a Data quality entry with an attention count
- **AND** the queue SHALL offer an explicit canonical resolution action
- **AND** it SHALL preserve the original source label and provider information for audit

### Requirement: Derived and source workflows use appropriate table actions

The Inputs UI SHALL not render add, edit, remove, or reorder controls for read-only assignment history or mapping rows unless the action is explicitly part of that resource's supported workflow.

#### Scenario: Admin opens advanced assignment history

- **WHEN** the assignment history view renders
- **THEN** it SHALL use read-only table styling and omit generic CRUD controls

#### Scenario: Admin opens Data quality

- **WHEN** the Data quality queue renders
- **THEN** it SHALL show only the resolve action applicable to an unresolved mapping
- **AND** it SHALL omit irrelevant add/remove controls

### Requirement: Admin can manage definitions from Inputs

The admin interface SHALL expose a Definitions section alongside the existing Inputs sections. Authenticated administrators SHALL be able to view, add, edit, reorder, activate, and archive definitions and their locale-specific text and aliases.

#### Scenario: Admin opens Definitions
- **GIVEN** an authenticated administrator opens Inputs
- **WHEN** they select Definitions
- **THEN** the page SHALL show active and archived definitions with their scope and current order
- **AND** the page SHALL use the shared admin table and toolbar presentation

#### Scenario: Admin saves a definition
- **GIVEN** an administrator edits a definition with a unique key, valid label, explanation, and alias set
- **WHEN** they save the form with the shared mutation protection
- **THEN** the definition SHALL be persisted
- **AND** the next public render SHALL use the updated metadata

#### Scenario: Admin archives instead of deleting history
- **GIVEN** an existing definition is no longer needed
- **WHEN** an administrator archives it
- **THEN** it SHALL become inactive and disappear from public matching
- **AND** its stable key and audit history SHALL remain recoverable

#### Scenario: Invalid definition edits are rejected
- **GIVEN** an administrator submits a duplicate key, empty explanation, malformed alias, or missing form token
- **WHEN** the mutation is processed
- **THEN** the system SHALL reject the change with an actionable error
- **AND** the previous definition SHALL remain unchanged

### Requirement: Season-scoped admin pages share one season context

The admin interface SHALL provide one reusable season context for Inputs, Race data, Actuals, and other season-scoped workspaces, while leaving global pages explicitly unscoped.

#### Scenario: Admin switches season from a season-scoped page

- **WHEN** an admin selects another season
- **THEN** the current page SHALL reload using that season
- **AND** its tabs, round selectors, and internal links SHALL preserve the selected season

#### Scenario: Admin opens global Questions settings

- **WHEN** an admin opens the Questions settings page
- **THEN** the page SHALL identify its settings as global
- **AND** it SHALL not show a misleading season selector until question configuration is season-specific

### Requirement: Admin data tables share consistent interaction patterns

The admin interface SHALL use a reusable table interaction pattern for applicable data tables: compact headers, selectable rows, contextual toolbar actions, inline editor rows, and resource-specific add/deactivate controls.

#### Scenario: Admin selects a table row

- **WHEN** an admin clicks or keyboard-selects a row
- **THEN** the row SHALL receive a visible selected state
- **AND** only actions applicable to that resource SHALL become available

#### Scenario: Resource has no primary add or delete operation

- **WHEN** a table represents derived history, a fixed calendar, or canonical mappings
- **THEN** the toolbar SHALL omit irrelevant add/remove controls
- **AND** the table SHALL explain the appropriate read-only or resolve workflow

### Requirement: Technical fields stay out of primary admin tables

Primary admin tables SHALL hide raw database identifiers, internal slugs, and low-value provenance fields while preserving them for APIs, audit logs, diagnostics, and advanced workflows.

#### Scenario: Assignment history is shown

- **WHEN** an admin opens lineup history
- **THEN** the table SHALL show driver, team, seat, and effective rounds
- **AND** it SHALL not require the admin to interpret an internal source field or database ID

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

### Requirement: Inputs does not expose ambiguous activity status

The Inputs Drivers and Teams workflows SHALL not present an Active column, Active checkbox, or activity mutation field for canonical or season roster records.

#### Scenario: Admin opens Drivers inputs

- **GIVEN** an admin opens Drivers for a selected season
- **WHEN** the table renders or a driver editor opens
- **THEN** the UI SHALL show driver number, identity, and relevant season/team information
- **AND** it SHALL not show an Active value or Active checkbox

#### Scenario: Admin opens Teams inputs

- **GIVEN** an admin opens Teams for a selected season
- **WHEN** the table renders or a team editor opens
- **THEN** the UI SHALL show team order and seat periods
- **AND** it SHALL not show an Active value or Active checkbox

### Requirement: Inputs uses assignments as the grid-status explanation

The Inputs workflow SHALL communicate current participation through round-bounded seat periods rather than a global driver status.

#### Scenario: Driver has a gap between assignments

- **GIVEN** a driver has no assignment covering a selected round
- **WHEN** an admin reviews the team lineup history
- **THEN** the gap SHALL remain visible as no seat assignment
- **AND** the system SHALL not label the driver retired or inactive based on that gap

