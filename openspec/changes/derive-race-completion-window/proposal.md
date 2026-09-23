## Why

The live time-based race status currently changes from Upcoming to Started at the scheduled start but has no natural transition to Completed. A conservative twelve-hour window makes the status useful for the admin overview while still allowing explicit cancellation and partial-result overrides.

## What Changes

- Derive Completed automatically twelve hours after a valid scheduled start.
- Keep Started during the twelve-hour post-start window.
- Preserve explicit completed, cancelled, and partial calendar states as overrides.
- Add deterministic boundary tests and keep all existing stored race data compatible.

## Capabilities

### New Capabilities

- race-completion-window: Defines the automatic twelve-hour transition from Started to Completed.

### Modified Capabilities


## Impact

- Race status derivation in the season-input domain model.
- Focused unit tests and the existing admin races table output.
- No schema migration, data rewrite, or production deployment.
