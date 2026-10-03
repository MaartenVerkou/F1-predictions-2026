## Context

The season-input race records already store a scheduled instant, timezone, and a calendar_state. The admin races table currently renders calendar_state directly, so the normal scheduled default becomes stale as soon as the start time passes. The existing state also carries facts such as cancellation and partial completion that cannot be recovered from a timestamp.

## Goals / Non-Goals

**Goals:**

- Provide a single read-time mapping for the admin race status.
- Use the server's current instant and the stored scheduled instant for the automatic path.
- Keep explicit completed, cancelled, and partial values as durable overrides.
- Make the editor and labels explain that scheduled means automatic derivation.
- Keep the database shape and existing stored values compatible.

**Non-Goals:**

- Inferring race completion from a start time alone.
- Adding an end-time or race-session timing model.
- Rewriting existing season data or production records.
- Changing the separate race-data evidence calendar state.

## Decisions

### One pure status derivation boundary

Add a small domain helper beside the season-input mapping that accepts a race and an optional current instant, returning a stable status key. Explicit `cancelled`, `partial`, and `completed` states win first. For the normal `scheduled` state, a valid future start returns `upcoming`, a passed start returns `started`, and a missing/invalid start returns `unscheduled`.

This keeps clock logic out of the template and makes boundary cases directly testable. The helper receives the current instant rather than reading the clock internally so tests remain deterministic.

### Present a live status while retaining source state

The route will attach the derived status to each race view model. The table will render localized labels from that derived key. The editor will continue to submit the stored calendar state, but the `scheduled` option will be labeled Automatic so administrators understand that it is not a stale manual status.

An alternative was removing calendar_state entirely and inferring everything from time. That was rejected because cancellation, partial results, and verified completion are not derivable from a start instant.

### Localized status labels

Add locale keys for Upcoming, Started, Completed, Cancelled, Partial, and Unscheduled, plus a concise label for the override selector. The status keys remain language-neutral in the domain model.

## Risks / Trade-offs

- [A race may be ongoing after its start] → Use Started rather than claiming Completed; explicit completion remains available.
- [Server clock differs from the event source] → Compare ISO instants consistently and keep the scheduled timezone only for formatting.
- [Existing templates or tests expect raw calendar_state] → Add the derived view field without removing the stored field; update only the races table display and focused tests.
- [Locale coverage is incomplete] → Provide fallback text for every new key and verify all supported locale files in tests/lint.

## Migration Plan

Deploy the code without a database migration. Existing `calendar_state` values continue to work. Verify the preview races table against a future race, a past scheduled race, and each explicit override. Roll back by reverting the code commit; no data rollback is needed.
