## ADDED Requirements

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
