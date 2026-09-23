## MODIFIED Requirements

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
