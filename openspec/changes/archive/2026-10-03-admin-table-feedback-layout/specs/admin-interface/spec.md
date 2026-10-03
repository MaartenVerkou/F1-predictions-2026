## ADDED Requirements

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
