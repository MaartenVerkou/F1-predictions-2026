## Context

The existing live race status helper derives Upcoming or Started from the scheduled start instant and preserves explicit calendar overrides. The admin races table therefore has no automatic completed state for the ordinary scheduled path.

## Goals / Non-Goals

**Goals:**

- Add a fixed, documented twelve-hour completion window.
- Keep the transition deterministic and testable at the exact boundary.
- Preserve the existing explicit override behavior and stored schema.

**Non-Goals:**

- Modeling separate sessions, race end times, red flags, or delays.
- Mutating calendar_state values in the database.
- Changing race-data evidence or actuals review state.

## Decisions

The domain helper will use a named twelve-hour constant and compare elapsed milliseconds after validating both instants. The normal scheduled path returns Upcoming, Started, or Completed based on the boundary; explicit completed, cancelled, and partial values continue to win first.

A shorter four-hour window was considered but rejected as too close to the expected race duration. A data-driven completion rule based on actuals was also considered, but it would leave old races without imported results stuck in Started and would couple the calendar table to review workflow. Twelve hours is a simple, conservative calendar-level approximation while verified data can still be represented explicitly.

## Risks / Trade-offs

- [A severely delayed or red-flagged race could exceed twelve hours] → Administrators can select Partial or Completed as an explicit override.
- [The helper does not know the actual chequered-flag time] → The UI label remains a calendar status, not a timing result.

## Migration Plan

Deploy code only; no migration or data rewrite is needed. Existing scheduled rows automatically display the new status on the next request. Rollback is a code revert.
