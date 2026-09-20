## ADDED Requirements

### Requirement: Season actuals review avoids duplicate operational summaries
The system SHALL present the Season actuals review state in one compact workspace rather than repeating selected snapshot status, sync metadata, no-snapshot instructions, and race-review counts in separate prominent panels.

#### Scenario: Admin opens Season actuals with review backlog
- **GIVEN** an authenticated admin opens the Season actuals page with one or more pending snapshots
- **WHEN** the page renders
- **THEN** it SHALL show one race selector followed by at most one selected-snapshot metadata/action line
- **AND** it SHALL not show a season-wide pending-count summary or repeat latest-sync metadata
