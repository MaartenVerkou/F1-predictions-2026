## Why

The races table currently presents the stored calendar_state as if it were a live status. Because the default value remains scheduled, a race can still look scheduled after its start time has passed. The UI needs a truthful, automatically updated temporal state without losing explicit information such as cancellations or partial results.

## What Changes

- Derive the visible temporal race status from the scheduled start time at read time.
- Show future races as upcoming and races whose start has passed as started.
- Keep explicit completed, cancelled, and partial states as overrides because start time alone cannot establish those facts.
- Make the race editor describe the stored value as a calendar-state override, with the normal scheduled value using live time derivation.
- Add focused tests for the derived status rules and preserve production data unchanged.

## Capabilities

### New Capabilities

- race-calendar-status: Defines live temporal status derivation and explicit calendar-state overrides for season races.

### Modified Capabilities


## Impact

- Season-input domain mapping and the admin inputs race table.
- Race editor labels and localized status text.
- Unit tests for time-based status derivation.
- No database migration or production data rewrite is required; existing calendar_state values remain stored as override/source data.
