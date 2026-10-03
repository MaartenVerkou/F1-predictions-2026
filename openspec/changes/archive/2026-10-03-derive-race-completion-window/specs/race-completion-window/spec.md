## Purpose

Provides a predictable automatic completion point for races whose scheduled start has passed, without overwriting explicit calendar facts recorded by an administrator.

## ADDED Requirements

### Requirement: Races complete twelve hours after automatic start

For a race whose stored calendar state is scheduled and whose scheduled start is valid, the system SHALL show Upcoming before the start, Started from the start until twelve hours have elapsed, and Completed at or after twelve hours.

#### Scenario: Race is still upcoming
- **WHEN** the scheduled start is later than the current instant
- **THEN** the visible race status is Upcoming

#### Scenario: Race is within the completion window
- **WHEN** the scheduled start has passed but less than twelve hours have elapsed
- **THEN** the visible race status is Started

#### Scenario: Completion window has elapsed
- **WHEN** twelve hours or more have elapsed since the scheduled start
- **THEN** the visible race status is Completed

### Requirement: Explicit calendar facts remain authoritative

The system SHALL continue to display explicit completed, cancelled, and partial calendar states regardless of the twelve-hour calculation.

#### Scenario: Cancellation overrides timing
- **WHEN** a race has explicit calendar state cancelled
- **THEN** the visible race status is Cancelled

#### Scenario: Partial result overrides timing
- **WHEN** a race has explicit calendar state partial
- **THEN** the visible race status is Partial

#### Scenario: Missing start remains unavailable
- **WHEN** a scheduled race has no valid scheduled start
- **THEN** the visible race status is No start time
