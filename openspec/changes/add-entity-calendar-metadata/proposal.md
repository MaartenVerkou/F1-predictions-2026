## Why

Teams and races currently have only names, dates, and a few operational fields. Stable codes and geographic metadata make the canonical input model easier to identify, audit, reuse, and extend to future seasons without relying on display names.

## What Changes

- Add team code, primary F1 base country, and first F1 season metadata.
- Add race code, country, circuit name, and retain the existing IANA start timezone as visible metadata.
- Seed 2026 values from official Formula 1 team and calendar information where available; keep fields nullable for future or historical records that need research.
- Expose the metadata compactly in the admin teams and races tables and make it editable with the existing row editor.
- Preserve stable IDs, existing assignments, and production data.

## Capabilities

### New Capabilities

- entity-calendar-metadata: Canonical team and race metadata for identity, geography, and calendar context.

### Modified Capabilities


## Impact

- SQLite and PostgreSQL season-input schemas and upsert/seed paths.
- Admin input forms, table presentation, and localized labels.
- No change to driver-team assignment semantics or actuals/evidence storage.
