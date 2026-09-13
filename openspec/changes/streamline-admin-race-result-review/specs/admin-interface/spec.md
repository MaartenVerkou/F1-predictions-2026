## ADDED Requirements

### Requirement: Season actuals review avoids duplicate operational summaries
The system SHALL present the Season actuals review state in one compact workspace rather than repeating the selected snapshot status, sync metadata, and race-review list in separate prominent panels.

#### Scenario: Admin opens Season actuals with review backlog
- **GIVEN** an authenticated admin opens the Season actuals page with one or more pending snapshots
- **WHEN** the page renders
- **THEN** it SHALL show one compact pending-count summary and one race selector
- **AND** it SHALL not repeat the selected snapshot status or latest-sync metadata in separate review-summary panels
