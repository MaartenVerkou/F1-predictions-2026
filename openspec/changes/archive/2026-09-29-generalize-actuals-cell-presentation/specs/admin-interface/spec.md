## MODIFIED Requirements

### Requirement: Admin pages fit supported viewports

The system SHALL render admin pages within supported phone and desktop viewports without page-level horizontal overflow. The Season Actuals overview SHALL use one normal presentation mode and one compact presentation mode; both modes SHALL keep value content bounded inside the table's own scroll region.

Feature: Admin interface

Rule: Admin pages SHALL avoid page-level horizontal overflow while preserving dense operational data.

#### Scenario: Season actuals fits on phone
- **GIVEN** an admin opens the Season actuals page on a phone-width viewport
- **WHEN** the page renders questions, target controls, review panels, and save controls
- **THEN** primary inputs and action controls SHALL fit within the viewport
- **AND** the page SHALL not create document-level horizontal scrolling
- **AND** the compact question label and all race/value cell content SHALL wrap or truncate within their cells
- **AND** DNF-per-race controls SHALL remain readable and operable

#### Scenario: Wide admin tables scroll inside their own region
- **GIVEN** an admin opens overview, detail, question settings, or analysis pages with wide tables
- **WHEN** the viewport is narrower than the table's useful minimum width
- **THEN** the table SHALL scroll horizontally inside a bounded table region
- **AND** the document itself SHALL not overflow horizontally
- **AND** long IDs, answers, and names SHALL wrap or truncate within their cells instead of expanding the page

#### Scenario: Admin action rows wrap predictably
- **GIVEN** an admin page contains multiple links, forms, or buttons in the same action area
- **WHEN** the viewport is narrow
- **THEN** the action controls SHALL wrap or stack without overlapping
- **AND** destructive actions SHALL remain visibly separate from navigation actions
