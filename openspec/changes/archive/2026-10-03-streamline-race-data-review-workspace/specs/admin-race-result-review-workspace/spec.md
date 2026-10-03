## ADDED Requirements

### Requirement: Race evidence review is independent of question selection
The system SHALL treat the selected round's canonical race evidence as the primary review surface. A question SHALL NOT be required to inspect, correct, or mark that race evidence reviewed; question selection SHALL only control optional derivation inspection.

#### Scenario: Admin opens race data without a question
- **GIVEN** an admin selects a season and round
- **WHEN** the Race Data workspace renders with no derivation question selected
- **THEN** the finish-order evidence table SHALL still be complete and actionable
- **AND** the page SHALL not require a question selection before the admin can inspect or correct evidence

### Requirement: Race Data exposes the selected snapshot review state
The system SHALL show the selected round's snapshot state beside the primary evidence and SHALL provide a protected Mark reviewed action when that snapshot is pending. Marking reviewed SHALL use the existing actual-snapshot publication lifecycle and SHALL return the admin to the same Race Data round.

#### Scenario: Admin marks a pending round reviewed
- **GIVEN** the selected round has a pending actual snapshot
- **WHEN** an authorized admin activates Mark reviewed
- **THEN** the request SHALL require the normal admin and CSRF protections
- **AND** the snapshot SHALL be marked reviewed and published through the existing lifecycle
- **AND** the response SHALL preserve the selected season, round, table view, and derivation focus

#### Scenario: Admin views an already reviewed round
- **GIVEN** the selected round has a reviewed snapshot
- **WHEN** the Race Data workspace renders
- **THEN** it SHALL show the reviewed state and review time without offering a second pending action

### Requirement: Compact identity presentation preserves discoverability
The primary evidence and championship tables SHALL use compact stable driver and constructor codes when width is constrained, while the full canonical names remain available through an accessible label or tooltip. Compact presentation MUST NOT change identity, ordering, or correction targets.

#### Scenario: Admin reviews a compact result table
- **GIVEN** the Race Data workspace is rendered at a width where full identity names would crowd the facts
- **WHEN** a driver or constructor cell is displayed
- **THEN** the visible identity MAY use its stable three-letter code
- **AND** the full canonical name SHALL remain discoverable on hover and to assistive technology
- **AND** selecting and correcting the row SHALL continue to target the canonical driver identity

### Requirement: Derivation question selection stays compact and optional
The derivation section SHALL expose a compact question selector with numbered short labels and a full accessible description. Selecting a question SHALL update the relevant derivation view without changing the primary evidence review state.

#### Scenario: Admin selects a derivation question
- **GIVEN** an admin wants to validate one question's interpretation
- **WHEN** the admin selects a numbered question from the compact selector
- **THEN** the relevant driver or constructor derivation table SHALL update
- **AND** the primary evidence table and review action SHALL remain available
- **AND** the full question wording SHALL remain available through the selected option's accessible name or tooltip
