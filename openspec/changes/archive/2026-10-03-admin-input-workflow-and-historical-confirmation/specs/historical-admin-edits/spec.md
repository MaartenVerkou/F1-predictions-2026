## Purpose

Make historical season corrections explicit, understandable, and consistently enforceable across all admin Inputs mutations without weakening server-side lifecycle protection.

## ADDED Requirements

### Requirement: Archived mutations require an explicit confirmation

The system SHALL reject state-changing mutations for an archived season unless the request contains an explicit historical-correction confirmation, and SHALL retain the existing preparation behavior for planned seasons.

#### Scenario: Archived mutation is submitted without confirmation

- **WHEN** an authenticated admin submits any season-scoped Inputs mutation for an archived season without confirmation
- **THEN** the system SHALL reject the mutation
- **AND** no canonical data SHALL change
- **AND** the response SHALL identify that a historical correction confirmation is required

#### Scenario: Archived mutation is submitted with confirmation

- **WHEN** an authenticated admin submits a valid season-scoped Inputs mutation for an archived season with explicit confirmation
- **THEN** the system SHALL apply the mutation according to the endpoint's validation rules
- **AND** the mutation SHALL be audit logged with the season and actor

### Requirement: One shared confirmation flow covers all Inputs mutations

The system SHALL expose one reusable confirmation interaction for archived-season team ordering, entity edits, add/remove actions, lineup edits, and mapping resolution, rather than requiring a control that is present only in one editor.

#### Scenario: Admin submits an archived team-order action

- **WHEN** an admin activates a team order control for an archived season
- **THEN** the confirmation interaction SHALL identify the archived season and historical nature of the action
- **AND** confirming SHALL submit the action with the historical-correction flag
- **AND** cancelling SHALL leave the order unchanged

#### Scenario: Admin submits an archived form mutation

- **WHEN** an admin saves, adds, removes, or resolves an Inputs entity for an archived season
- **THEN** the same confirmation interaction SHALL be used before submission
- **AND** the user SHALL not need to find a separate checkbox in an unrelated table or editor

### Requirement: Historical confirmation remains server-authoritative

The system SHALL treat the browser dialog as a convenience only and SHALL enforce the confirmation flag at every mutation boundary, including compatibility endpoints that are not primary UI workflows.

#### Scenario: Client omits the confirmation flag

- **WHEN** a request bypasses the browser interaction and omits the historical-correction flag
- **THEN** the server SHALL reject the request using the lifecycle policy
- **AND** the rejected response SHALL not reveal or partially apply the mutation

### Requirement: Confirmation feedback is actionable

The system SHALL render lifecycle errors in the shared admin feedback area with enough context to explain what the admin must do next.

#### Scenario: Confirmation is missing

- **WHEN** a mutation is rejected because historical confirmation is missing
- **THEN** the page SHALL identify the selected season as archived
- **AND** it SHALL explain that the action can be retried and confirmed
- **AND** the error SHALL remain outside the table toolbar and data rows
