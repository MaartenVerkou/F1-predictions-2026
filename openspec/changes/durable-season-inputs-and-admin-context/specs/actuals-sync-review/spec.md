## ADDED Requirements

### Requirement: Actuals review is season-aware without changing live scoring implicitly

The Season actuals workspace SHALL read snapshots for the selected season, while public live scoring and automatic provider sync SHALL remain tied to the active season unless an explicit season operation is requested.

#### Scenario: Admin inspects archived actuals

- **WHEN** an admin selects an archived season in Actuals
- **THEN** the page SHALL show that season's snapshots and review state
- **AND** selecting it SHALL not overwrite active-season live actuals

#### Scenario: Automatic sync is requested for a planned season

- **WHEN** automatic live sync is invoked without an explicit historical or preparation operation
- **THEN** the system SHALL reject the planned-season sync
- **AND** it SHALL explain that live sync is restricted to the active season

### Requirement: Actuals review preserves the selected season and round context

The Season actuals selector and review actions SHALL preserve the selected season and selected round across navigation, save, and review operations.

#### Scenario: Admin saves a historical snapshot correction

- **WHEN** an admin saves a snapshot for a selected archived-season round
- **THEN** the correction SHALL remain attached to that season and round
- **AND** the active season's live scoring source SHALL remain unchanged
