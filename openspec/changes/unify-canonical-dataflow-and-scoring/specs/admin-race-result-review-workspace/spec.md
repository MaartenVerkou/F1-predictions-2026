## ADDED Requirements

### Requirement: Race data and Actuals share one evidence and cutoff view
The admin Race data and Actuals workspaces SHALL use the same selected season, round cutoff, normalized evidence revision, catalog revision, coverage state, and derived snapshot identity for a review operation.

#### Scenario: An admin selects a round in Race data
- **WHEN** the admin opens the corresponding Actuals review for that round
- **THEN** the Actuals workspace SHALL show the same cutoff and source evidence identity
- **AND** it SHALL not re-fetch or independently reinterpret the provider payload

#### Scenario: Evidence is not ready for a selected round
- **WHEN** the selected round has missing, partial, or unresolved evidence
- **THEN** both workspaces SHALL show the same blocking or warning state
- **AND** the review action SHALL explain what must be resolved before publication

### Requirement: Review actions are separated from evidence inspection
The workspace SHALL distinguish immutable observed evidence from derived actual values and from an administrator's explicit correction, while keeping the source chain visible without duplicating large metadata blocks.

#### Scenario: An admin reviews a derived value
- **WHEN** the selected round contains a derived answer
- **THEN** the workspace SHALL show the interpreted value and its source chain
- **AND** marking the snapshot reviewed SHALL not alter the stored evidence

#### Scenario: An admin corrects a value
- **WHEN** the admin saves a correction
- **THEN** the correction SHALL be stored as an explicit override with audit metadata
- **AND** the original derived value SHALL remain recoverable

### Requirement: Constructor race cells expose canonical podium facts
The constructor race-data matrix SHALL derive podium indicators from the same normalized Grand Prix driver results used by actuals derivation. A constructor SHALL be marked with its best classified driver finish of 1, 2, or 3 for a round when applicable; sprint-only results SHALL not create a Grand Prix podium indicator.

#### Scenario: A constructor has a podium driver
- **GIVEN** persisted race evidence contains a driver finish in positions 1 through 3 for a constructor
- **WHEN** the constructor matrix is rendered for a cutoff that includes that round
- **THEN** the points cell SHALL retain the constructor's race and sprint points
- **AND** it SHALL show a compact, position-specific podium indicator with an accessible explanation of the driver finish

#### Scenario: A constructor has no Grand Prix podium
- **GIVEN** all of a constructor's driver results are outside positions 1 through 3, or evidence is unavailable
- **WHEN** the constructor matrix is rendered
- **THEN** the cell SHALL not show a podium indicator
- **AND** future or unavailable cells SHALL remain visually muted and semantically distinguishable

#### Scenario: Constructor totals remain points-only
- **WHEN** the constructor matrix is rendered
- **THEN** the merged constructor total SHALL use the same plain points presentation as the driver matrix
- **AND** win, pole, and podium aggregates SHALL remain outside this table until a dedicated summary design is introduced

### Requirement: Race data switches driver and constructor order in one matrix
The Race data workspace SHALL use one shared matrix and reusable row/cell partials with identical result cells for driver and constructor views. The server SHALL render only the selected view's identity header and rows at a time; it SHALL not duplicate the full alternative matrix in the page DOM. The constructor view SHALL always group the selected-round seat rows under their constructor, show the team once in a vertically merged identity cell, and merge the championship position and constructor total points across the team's two seat rows. Seat order remains the canonical driver 1/driver 2 order without adding artificial Driver 1/Driver 2 data fields or displaying driver names in this view.

#### Scenario: An administrator selects the constructor view
- **WHEN** the administrator selects the Constructors control
- **THEN** each constructor SHALL render one group containing its seat 1 and seat 2 drivers in canonical seat order
- **AND** the team SHALL appear once in the single constructor identity column spanning the seat rows
- **AND** the position and total points SHALL remain one vertically merged group value
- **AND** each driver row SHALL use the existing driver result cells, marker semantics, and responsive labels

#### Scenario: The view control reorders the existing matrix in place
- **WHEN** the administrator switches between Drivers and Constructors
- **THEN** the workspace SHALL keep the page shell and replace only the server-rendered race-data region
- **AND** the selected region SHALL use the same row and result-cell partials without duplicating the inactive view in the DOM
- **AND** the switch SHALL complete without a full-page navigation when client-side enhancement is available
- **AND** the selected view SHALL remain represented in the URL for refresh and sharing

#### Scenario: The round selector refreshes the same region
- **WHEN** the administrator selects another race round or follows a round header link
- **THEN** the page SHALL replace only the race-data region with the selected round's server-rendered cutoff, matrix, legend, and detail state
- **AND** the selected round and view SHALL remain represented in the URL for refresh and sharing
- **AND** a normal GET navigation SHALL remain available when client-side enhancement is unavailable

#### Scenario: Constructor grouping follows the selected round lineup
- **WHEN** a historical or current round is selected
- **THEN** driver rows SHALL be resolved from the season's canonical assignment projection at that round
- **AND** a mid-season replacement SHALL appear only from its assignment start round onward
- **AND** an empty seat SHALL remain visibly unavailable without borrowing a driver from another round
