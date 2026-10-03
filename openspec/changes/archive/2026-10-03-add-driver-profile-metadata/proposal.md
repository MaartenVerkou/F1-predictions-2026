## Why

The Drivers view currently mixes canonical driver identity with a derived team relationship and only exposes the season number. Removing the team column leaves room for compact, reusable driver metadata that is useful across seasons without duplicating time-bounded team assignments. Code, nationality, and age provide recognizable context while preserving Teams as the single source of truth for lineup history.

## What Changes

- Add canonical driver profile metadata for an official short code, nationality code, and date of birth.
- Keep driver number as season-specific data and calculate a display age from the date of birth for the selected season.
- Show the Drivers table as `# | Driver | Code | Nationality | Age` and remove the derived Team column.
- Add the metadata fields to the driver editor and creation flow with validation and localized labels.
- Preserve existing team/seat assignment behavior; no team relationship is copied into driver metadata.

## Capabilities

### New Capabilities

- `driver-profile-metadata`: Canonical driver profile fields and season-aware age presentation in admin Inputs.

### Modified Capabilities

- `admin-interface`: The Drivers view presents profile metadata and no longer presents a derived team column.

## Impact

- Additive driver schema changes and SQLite/PostgreSQL migration/backfill handling.
- Admin input routes, templates, styles, localized labels, and validation.
- Existing drivers remain valid with nullable metadata; missing values render as `—`.
- Teams remains the only editable source for driver/team/seat periods.
