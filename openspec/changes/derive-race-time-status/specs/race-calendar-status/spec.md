## Purpose

Provides a trustworthy race status that updates from the scheduled start time while preserving explicit calendar facts that time alone cannot determine.

## ADDED Requirements

### Requirement: Race status is live from the scheduled start

The system SHALL derive the visible temporal status at read time using the race's scheduled start instant: a future start is `upcoming`, and a start at or before the current instant is `started`.

#### Scenario: Future race is upcoming
- **WHEN** a race has a valid scheduled start later than the current instant and no explicit exception state
- **THEN** the races table shows the race as Upcoming

#### Scenario: Race start has passed
- **WHEN** a race has a valid scheduled start at or before the current instant and no explicit exception state
- **THEN** the races table shows the race as Started

#### Scenario: Race without a start time
- **WHEN** a race has no valid scheduled start
- **THEN** the races table shows that its start status is unavailable rather than guessing from the stored default

### Requirement: Explicit calendar states override temporal status

The system SHALL preserve and display explicit `completed`, `cancelled`, and `partial` calendar states as overrides, regardless of the current time relative to the scheduled start.

#### Scenario: Cancelled race remains cancelled
- **WHEN** a race has explicit calendar state `cancelled`
- **THEN** the races table shows Cancelled even if its start time is in the future or past

#### Scenario: Partial race remains partial
- **WHEN** a race has explicit calendar state `partial`
- **THEN** the races table shows Partial even if its start time is in the future or past

#### Scenario: Completed race remains completed
- **WHEN** a race has explicit calendar state `completed`
- **THEN** the races table shows Completed even if the current time changes

### Requirement: Race editing distinguishes automatic status from overrides

The race editor SHALL identify the stored scheduled value as automatic time-based derivation and SHALL continue to allow explicit completed, cancelled, and partial values for calendar facts that cannot be inferred from start time.

#### Scenario: Editor uses automatic derivation by default
- **WHEN** an administrator leaves a race's calendar state as scheduled and saves it
- **THEN** subsequent reads derive Upcoming or Started from the scheduled start time

#### Scenario: Administrator records an exception
- **WHEN** an administrator selects completed, cancelled, or partial and saves the race
- **THEN** subsequent reads display the selected explicit state as the override
