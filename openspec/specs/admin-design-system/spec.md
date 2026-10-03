# admin-design-system Specification

## Purpose

Define the shared visual primitives and responsive table contract used by the
WOK admin workspace.

## Requirements

### Requirement: Admin surfaces use shared visual primitives

Admin Race Data, Results, Questions, Season Inputs, Definitions, and analysis surfaces SHALL use shared classes or partials for page headings, action toolbars, segmented controls, compact buttons, table scroll shells, and status/metadata lines.

#### Scenario: Equivalent controls appear on different admin pages

- **WHEN** an admin compares an edit action or segmented view control on two supported admin pages
- **THEN** the controls SHALL have the same height, border treatment, typography, active state, focus state, and spacing
- **AND** any difference SHALL be expressed as an explicit documented variant rather than duplicated page-specific rules

### Requirement: Shared tokens define admin geometry and theme surfaces

The admin design system SHALL define semantic tokens for spacing, control height, table cell density, border/radius, typography, and light/dark surface colors. Page styles MUST consume these tokens for shared geometry instead of repeating literal values.

#### Scenario: Admin page spacing is adjusted centrally

- **WHEN** a shared admin spacing or control-height token is changed
- **THEN** all migrated admin pages SHALL receive the corresponding geometry change
- **AND** domain-specific table widths SHALL remain opt-in variants

### Requirement: Tables remain bounded and accessible

Shared table shells SHALL keep wide tables scrollable inside their own region, preserve semantic table markup and headers, and expose keyboard focus and readable empty/loading/error states.

#### Scenario: A wide table is opened on a phone

- **WHEN** a migrated admin table is wider than the viewport
- **THEN** horizontal scrolling SHALL be confined to the table region
- **AND** the document SHALL not gain page-level horizontal overflow
- **AND** sticky or compact identity columns SHALL remain readable and keyboard reachable

### Requirement: Shared controls support both themes and reduced visual noise

The shared primitives SHALL render with sufficient contrast in light and dark themes, use one accent treatment for active states, and avoid decorative gradients or shadows unless a component variant explicitly requires them.

#### Scenario: Admin switches theme

- **WHEN** the admin changes between light and dark mode
- **THEN** headings, controls, table borders, active states, and status indicators SHALL remain legible and structurally consistent
- **AND** the layout SHALL not change solely because of the theme

### Requirement: Shared presentation behavior is regression-tested

The project SHALL include focused rendered-view assertions and Playwright coverage for representative shared primitives at desktop and compact viewports in both themes.

#### Scenario: A shared primitive regresses

- **WHEN** a future change removes a required class, active state, focus state, or bounded table shell
- **THEN** the focused test suite SHALL fail with a clear assertion tied to the affected admin surface
