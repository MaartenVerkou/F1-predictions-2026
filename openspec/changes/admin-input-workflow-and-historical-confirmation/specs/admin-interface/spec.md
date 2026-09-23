## ADDED Requirements

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
