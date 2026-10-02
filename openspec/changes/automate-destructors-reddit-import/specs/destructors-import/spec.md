## Purpose

Provides a reliable, reviewable import boundary for the community-maintained Destructors Championship updates that arrive after completed races.

## ADDED Requirements

### Requirement: Discover the configured Destructors publication

The system SHALL inspect the configured public RSS source for posts by the configured author whose season and Destructors title identify a race update. It SHALL resolve the post to one configured season round, and SHALL report a missing, ambiguous, malformed, or rate-limited source without changing race evidence or actuals.

#### Scenario: A new race post is discovered
- **WHEN** the RSS feed contains a new matching post with a unique season and race identity
- **THEN** the system SHALL create an import candidate containing the post identifier, canonical URL, author, title, publication time, source content, and detected round
- **AND** the candidate SHALL be safe to process again without creating a duplicate

#### Scenario: The author posts later than the race
- **WHEN** no matching post exists during an early polling attempt
- **THEN** the system SHALL record a waiting or missing-source result
- **AND** it SHALL leave existing evidence, actuals, and published scoring unchanged

#### Scenario: The source is rate-limited or unavailable
- **WHEN** the feed request returns a retryable failure
- **THEN** the importer SHALL apply bounded backoff and record the last failure
- **AND** it SHALL not treat the failure as an empty Destructors result

#### Scenario: Reddit is blocked but the configured API mirror is available
- **WHEN** the operator selects the Formula 1 Dashboard Destructors source and the mirror returns a machine-readable season payload
- **THEN** the importer SHALL create the same pending evidence boundary using the mirror's canonical API URL and payload hash
- **AND** it SHALL preserve the attribution to the community source instead of presenting the estimate as official F1 data

### Requirement: Persist source evidence and normalized damage facts

The system SHALL persist the original publication metadata and parser revision before deriving any damage values. It SHALL normalize uniquely matched driver/team references and retain the original labels, component text, source URL, and unresolved reasons. Missing or unparseable values SHALL remain unavailable rather than becoming zero.

#### Scenario: A machine-readable damage list is present
- **WHEN** a matching post contains damage rows that can be mapped to configured drivers and teams
- **THEN** the system SHALL persist normalized component rows with round, driver, team, cost inputs, and provenance
- **AND** the evidence SHALL remain linked to the original post

#### Scenario: A damage row cannot be mapped or priced
- **WHEN** a component or driver label is unknown, ambiguous, or missing a trustworthy cost
- **THEN** the system SHALL retain the raw row and unresolved reason
- **AND** the derived Destructors value SHALL be unavailable until an admin resolves it

#### Scenario: The same publication is imported twice
- **WHEN** an import is retried with the same post identifier and equivalent content
- **THEN** the system SHALL reuse the existing evidence revision
- **AND** it SHALL not add duplicate damage rows or snapshots

### Requirement: Keep imported Destructors data behind review

The system SHALL create a pending evidence/actual revision for a newly imported or changed publication. It SHALL expose the source chain and comparison with the previous reviewed revision to an admin, SHALL never publish the revision automatically, and SHALL allow the admin to keep the previous reviewed revision when the new one is rejected.

#### Scenario: A new import changes a round
- **WHEN** normalized damage values differ from the latest reviewed round evidence
- **THEN** the system SHALL create a new pending revision
- **AND** the current published actuals and scoring SHALL remain unchanged

#### Scenario: An admin approves an import
- **WHEN** an admin reviews the source and confirms the pending revision
- **THEN** the revision SHALL become the reviewed source for that round
- **AND** the existing actuals publication workflow SHALL determine when its derived values become live

#### Scenario: An admin rejects or rolls back an import
- **WHEN** an admin selects the prior reviewed revision instead of the pending import
- **THEN** the prior revision SHALL remain the active reviewed source
- **AND** the rejected import SHALL remain auditable without affecting scoring
