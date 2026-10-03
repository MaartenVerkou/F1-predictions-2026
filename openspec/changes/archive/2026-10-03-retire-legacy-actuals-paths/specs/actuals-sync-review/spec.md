## ADDED Requirements

### Requirement: Actuals synchronization has one persisted-evidence entry point
The system SHALL expose one admin synchronization action for importing evidence and deriving Actuals. The Actuals review form SHALL not expose a second action that fetches a live provider response only to populate unsaved form fields.

#### Scenario: Admin opens the Actuals workspace
- **WHEN** an administrator opens the current-season Actuals page
- **THEN** the page SHALL offer the persisted evidence sync/review workflow
- **AND** it SHALL not offer a legacy live-provider autofill action

#### Scenario: Admin reviews imported values
- **WHEN** an administrator runs synchronization and opens a derived snapshot
- **THEN** the displayed values SHALL come from persisted race evidence and its derivation snapshot
- **AND** the review, correction, and publication actions SHALL remain available

#### Scenario: Existing participant data is preserved
- **WHEN** the legacy autofill action is removed
- **THEN** participant responses, groups, users, race evidence, actual snapshots, and published actuals SHALL remain readable and unchanged
