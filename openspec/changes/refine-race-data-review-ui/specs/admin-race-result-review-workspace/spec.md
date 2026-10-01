## MODIFIED Requirements

### Requirement: Admin can review one selected race result in a canonical workspace
The system SHALL provide an admin-only Race Data workspace with Season and Round selectors grouped at the top, followed immediately by the selected round's canonical finish-order result table. The workspace SHALL not require a question focus to define the primary result layout.

#### Scenario: Admin selects a round
- **GIVEN** an admin selects a season and round
- **WHEN** the Race Data workspace renders
- **THEN** Season and Round SHALL remain visibly associated in the header
- **AND** the first data section SHALL be the selected round's finish-order result table
- **AND** the result rows SHALL be ordered by classified finish position, with non-classified status values displayed after classified results

#### Scenario: Admin changes the review metric
- **GIVEN** an admin is viewing the driver or constructor championship table
- **WHEN** the admin chooses another supported metric
- **THEN** the table SHALL keep the same identity, race-column, and total structure
- **AND** only the displayed metric values, ordering, totals, and relevant highlighting SHALL change
- **AND** the selected Season and Round SHALL remain unchanged

#### Scenario: Narrow viewport
- **GIVEN** the workspace is rendered in a narrow viewport
- **WHEN** the controls no longer fit as segmented buttons
- **THEN** the controls SHALL collapse to aligned compact selectors without moving the Round control outside the content area

### Requirement: Corrections use selectable rows and one protected edit action
The system SHALL make canonical result rows selectable and SHALL expose one compact Edit action in the result-table toolbar for the selected row. Saving a correction MUST continue to require admin authorization, CSRF validation, an explicit confirmation, a reason, and canonical identity/status validation; corrections MUST create a revision rather than mutate the base evidence.

#### Scenario: Admin edits one result
- **GIVEN** an admin selects exactly one persisted result row
- **WHEN** the admin activates Edit
- **THEN** an inline or adjacent protected editor SHALL open for that row
- **AND** the editor SHALL retain the selected snapshot identity and canonical driver identity
- **AND** no edit form SHALL be repeated in every result-table row

#### Scenario: Admin attempts an unconfirmed correction
- **GIVEN** an admin submits a correction without the required confirmation or reason
- **WHEN** the server validates the request
- **THEN** the correction SHALL be rejected with a clear error
- **AND** the base evidence, published actuals, participant responses, and scoring state SHALL remain unchanged

#### Scenario: Admin saves a valid correction
- **GIVEN** an authorized admin submits a valid confirmed correction
- **WHEN** the correction is accepted
- **THEN** a new auditable evidence revision SHALL be stored
- **AND** the affected derivation SHALL be regenerated as pending review
- **AND** the previously published scoring revision SHALL remain active until explicitly reviewed and published

### Requirement: Race result columns support review in a stable evidence order
The system SHALL present the most review-relevant race evidence in a stable order: podium indicators/results first where available, qualifying and sprint evidence next, then grid, status, and points. A missing provider field SHALL be shown as unavailable without shifting unrelated columns or inventing a value.

#### Scenario: Complete result evidence
- **GIVEN** a persisted result contains finish, qualifying, sprint, grid, status, and points evidence
- **WHEN** the finish-order table renders
- **THEN** those fields SHALL appear in the defined review order with compact consistent cells
- **AND** the row SHALL remain selectable independently of the displayed metric table below

#### Scenario: Partial result evidence
- **GIVEN** a persisted result lacks one or more optional evidence fields
- **WHEN** the finish-order table renders
- **THEN** the missing field SHALL use the shared unavailable presentation
- **AND** the remaining columns SHALL retain their stable positions

### Requirement: Derivation review remains separate from primary race facts
The system SHALL retain a separate derivation-review section with a question selector. Selecting a question SHALL choose the relevant driver or constructor metric view for interpretation, but SHALL not replace or reorder the primary finish-order result table.

#### Scenario: Admin validates a question derivation
- **GIVEN** an admin selects a derivation question after reviewing the primary facts
- **WHEN** the derivation section updates
- **THEN** the relevant driver or constructor metric view SHALL be shown using the same shared table components
- **AND** the selected Season and Round SHALL remain visible and unchanged
