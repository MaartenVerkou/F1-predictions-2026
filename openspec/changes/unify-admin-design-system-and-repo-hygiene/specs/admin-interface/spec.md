## MODIFIED Requirements

### Requirement: Shared admin controls have one compact presentation contract

Repeated admin segmented controls, compact selects, edit actions, and table toolbars SHALL use shared presentation classes and interaction states across Race Data, Questions, Results, and Season Inputs. Their shared geometry SHALL come from the admin design tokens and shared partials; page-specific variants MUST be explicit and limited to domain needs.

#### Scenario: Admin compares page toolbars

- **WHEN** an admin views the Race Data, Questions, Results, or Season Inputs toolbar
- **THEN** the control height, border treatment, active state, focus state, and spacing SHALL follow the same shared classes
- **AND** page templates SHALL not duplicate equivalent inline or page-specific control styles

#### Scenario: Admin changes the shared toolbar geometry

- **WHEN** the shared admin control token changes
- **THEN** all four pages SHALL use the updated geometry without page-specific markup changes

### Requirement: Admin pages fit supported viewports

The system SHALL render admin pages within supported phone and desktop viewports without page-level horizontal overflow. Wide tables SHALL use a shared bounded scroll shell and compact presentation mode rather than page-specific overflow workarounds.

#### Scenario: Season actuals fits on phone

- **GIVEN** an admin opens the Season actuals page on a phone-width viewport
- **WHEN** the page renders questions, target controls, review panels, and save controls
- **THEN** primary inputs and action controls SHALL fit within the viewport
- **AND** the page SHALL not create document-level horizontal scrolling
- **AND** compact question labels and race/value content SHALL wrap or truncate within their cells
- **AND** DNF-per-race controls SHALL remain readable and operable

#### Scenario: Wide admin tables scroll inside their own region

- **GIVEN** an admin opens an overview, detail, question settings, results, or analysis page with a wide table
- **WHEN** the viewport is narrower than the table's useful minimum width
- **THEN** the table SHALL scroll horizontally inside the shared bounded region
- **AND** the document itself SHALL not overflow horizontally
- **AND** long IDs, answers, and names SHALL wrap or truncate within their cells instead of expanding the page

#### Scenario: Admin action rows wrap predictably

- **GIVEN** an admin page contains multiple links, forms, or buttons in the same action area
- **WHEN** the viewport is narrow
- **THEN** the action controls SHALL wrap or stack without overlapping
- **AND** destructive actions SHALL remain visibly separate from navigation actions
