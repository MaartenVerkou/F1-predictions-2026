# actuals-sync-review Specification

## Purpose
Define how completed race actuals become live scoring and reviewable round snapshots.
## Requirements
### Requirement: Season sync stores round-scored actual snapshots

The system SHALL persist completed-round evidence and derive season-scoped actual snapshots from that evidence and the canonical season catalog. A reviewed/published actual set for one season SHALL drive live actuals and scoring for that season only; no global actuals projection or transient provider response may become the source of truth.

Feature: Actual sync review

Rule: Completed rounds SHALL be persisted as evidence, derived deterministically, and published only after review.

#### Scenario: Automatic sync backfills completed rounds
- **GIVEN** official or explicitly reconstructed evidence exists for one or more completed rounds in the configured season
- **WHEN** an admin runs season sync or the scheduled automatic sync runs
- **THEN** the system SHALL persist the evidence and derive a latest snapshot for every eligible completed round
- **AND** each snapshot SHALL retain its evidence, catalog, and derivation revisions
- **AND** the resulting snapshot SHALL remain pending review until an admin confirms it

### Requirement: Snapshot review state survives unchanged syncs

The system SHALL preserve reviewed metadata when a re-sync produces unchanged evidence and derived values, and SHALL create a new pending revision when evidence or derived values change.

Feature: Actual sync review

Rule: Re-running equivalent evidence SHALL preserve review history; a changed evidence revision SHALL require review again.

#### Scenario: Unchanged round sync preserves reviewed status
- **GIVEN** a round already has a reviewed published snapshot
- **AND** a later season sync produces identical evidence and derived values
- **WHEN** the sync finishes
- **THEN** the system SHALL keep the reviewed snapshot and reviewer metadata
- **AND** it SHALL not create a duplicate pending result

#### Scenario: Changed round sync creates a new pending latest snapshot
- **GIVEN** a round already has a reviewed published snapshot
- **AND** a later correction or provider revision changes the evidence or derived value
- **WHEN** the sync finishes
- **THEN** the system SHALL create a new revision for that round
- **AND** the new revision SHALL be marked pending review
- **AND** the previously published result SHALL remain active until review

### Requirement: Admins can review and correct round snapshots
The system SHALL expose pending review status to admins and SHALL allow a protected complete-table correction for an individual round snapshot without overwriting unrelated live scoring targets. The selected snapshot review view SHALL give the admin the relevant question context and interpreted actual values required to validate that round.

#### Scenario: Admin reviews the latest synced round
- **GIVEN** the latest synced round snapshot is pending review
- **WHEN** an admin opens the Season actuals page
- **THEN** the system SHALL show the live scoring source and the latest synced round in the selector
- **AND** the system SHALL allow the admin to select and mark the latest synced round reviewed
- **AND** the selected review view SHALL show the round's question context and interpreted actual values

#### Scenario: Admin edits a selected round snapshot
- **GIVEN** an admin targets a specific race round from the Season actuals selector
- **WHEN** the admin saves a valid protected correction for the complete evidence table
- **THEN** the system SHALL save a new immutable evidence revision for that selected round
- **AND** the system SHALL re-derive actuals from the corrected evidence
- **AND** the derived snapshot SHALL be marked reviewed by the correcting admin and published for that round
- **AND** saving a non-current round target SHALL not overwrite unrelated current-round evidence or scoring targets

#### Scenario: Corrected review identity is preserved
- **GIVEN** a corrected evidence revision was saved successfully
- **WHEN** an admin reopens that round
- **THEN** the review state SHALL identify the editor and edit timestamp as `Edited by …`
- **AND** the original provider revision SHALL remain available in revision history

### Requirement: Cancelled races do not block historical backfill
The system SHALL keep cancelled races in season ordering and SHALL continue round-history backfill when those races have no official result rows.

Feature: Actual sync review

Rule: Race-derived actuals SHALL tolerate cancelled season rounds so later completed rounds can still be scored.

#### Scenario: Cancelled races stay in season history with zero result-derived values
- **GIVEN** the configured race calendar includes cancelled rounds with no official race result
- **WHEN** season sync computes round-based actuals and snapshot history
- **THEN** the system SHALL keep those cancelled rounds in season ordering
- **AND** the system SHALL record zero race-result-derived values for those cancelled rounds where applicable
- **AND** the system SHALL continue syncing later completed rounds

### Requirement: Season sync persists source evidence before deriving actuals

The system SHALL create a named import batch and persist normalized source evidence for each available season round before calculating derived actual snapshots.

#### Scenario: Import then derive from persisted bundles

- **GIVEN** official or configured source data is available for a completed round
- **WHEN** an admin or scheduled process runs season sync
- **THEN** the system SHALL create an import batch with source, parser, lifecycle, and coverage metadata
- **AND** the system SHALL persist the normalized round bundle under that batch
- **AND** the derived actual calculation SHALL read the persisted bundles through the requested cutoff rather than the transient provider response
- **AND** the derived snapshot SHALL link to the import batch and exact round bundle

#### Scenario: Re-running unchanged values refreshes evidence without losing review state

- **GIVEN** a round has a reviewed snapshot and a later import derives the same actual values
- **WHEN** the later import completes
- **THEN** the system SHALL preserve the snapshot's reviewed status and review metadata
- **AND** the system SHALL associate the usable evidence from the later import with the unchanged derived values

#### Scenario: A source is incomplete or unavailable

- **GIVEN** one configured source feed is unavailable or contains no result for a round
- **WHEN** the import completes
- **THEN** the system SHALL record the missing/incomplete coverage state and import status
- **AND** the system SHALL not invent driver results, points, or statuses
- **AND** the derived calculation SHALL follow its existing missing-source behavior

#### Scenario: Historical evidence is reconstructed

- **GIVEN** a historical derived snapshot has no captured source bundle
- **WHEN** an administrator runs a historical reconstruction import
- **THEN** the import SHALL be marked reconstructed with a current fetched timestamp and source note
- **AND** the system SHALL not claim that the reconstruction is the original historical capture
- **AND** existing reviewed metadata SHALL remain unchanged when values do not change

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

### Requirement: Single-round source refresh is pending until reviewed

The actuals sync workflow SHALL support refreshing exactly one selected race round through the canonical provider pipeline. A successful refresh SHALL re-derive that round's actual snapshot, mark it pending review, and SHALL NOT publish it automatically or overwrite earlier evidence revisions.

#### Scenario: Refreshed evidence changes a round answer
- **GIVEN** a round has an existing provider or admin-correction revision
- **WHEN** a source refresh produces different evidence or derived values
- **THEN** the system SHALL store the new provider revision and derived snapshot
- **AND** the derived snapshot SHALL be pending review
- **AND** the previously stored revision SHALL remain available in revision history

#### Scenario: Refreshed evidence is unchanged
- **GIVEN** a round has an existing revision
- **WHEN** a source refresh produces the same canonical evidence and answers
- **THEN** the system SHALL still record the provider fetch provenance
- **AND** it SHALL preserve the existing review history while leaving the selected derived snapshot pending review for explicit confirmation

#### Scenario: Provider failure leaves scoring unchanged
- **GIVEN** a source request fails or returns incomplete data that cannot form a valid round snapshot
- **WHEN** the single-round refresh finishes
- **THEN** no new evidence or actual snapshot SHALL be committed
- **AND** the currently published scoring values SHALL remain unchanged

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

