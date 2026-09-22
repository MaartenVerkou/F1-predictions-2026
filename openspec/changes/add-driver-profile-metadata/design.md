## Context

The canonical `drivers` table currently stores names only, while `season_drivers` stores season-specific number and display override data. Team membership is already represented by round-bounded `driver_team_assignments`. The change must work for SQLite previews/tests and PostgreSQL production without storing a derived age.

## Goals / Non-Goals

**Goals:**

- Add nullable, reusable driver profile metadata with the same identity across seasons.
- Calculate a deterministic age for the selected season and expose it in the compact Drivers table.
- Keep number and display override season-specific and keep team membership in Teams.
- Preserve existing drivers and allow partial metadata during migration.

**Non-Goals:**

- Adding team, active, retirement, or current-grid fields to drivers.
- Replacing provider mappings or importing external profile data automatically.
- Making age editable as a separate field.

## Decisions

1. **Canonical profile columns.** Add nullable `driver_code`, `nationality_code`, and `date_of_birth` columns to `drivers`. Codes are normalized to uppercase; driver code is exactly three letters and nationality is an ISO-style two-letter code. Dates use `YYYY-MM-DD`.

2. **Season-aware age.** Derive age from the first scheduled race in the selected season, with 1 January of the season as a fallback. This keeps archived season views reproducible and avoids age changing simply because the page was opened later.

3. **One editor path.** Extend the existing driver edit/add forms and route validation. The list query returns profile metadata and the derived age input date; no separate metadata screen is introduced.

4. **Seed compatibility.** Existing rows remain nullable. The seed path accepts an optional profile metadata map so sanitized preview fixtures can be populated without copying production data; deployments do not infer values from names.

5. **Migration safety.** SQLite adds missing columns through the existing schema bootstrap helper. PostgreSQL adds the same columns with idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements after the base table creation.

## Risks / Trade-offs

- **Incomplete metadata** → render `—` and keep all fields optional.
- **Ambiguous nationality conventions** → validate/store uppercase two-letter codes but do not infer them from names.
- **Date-only age boundaries** → use a documented season reference date so historical seasons remain deterministic.
- **Existing seed scripts omit profiles** → keep the profile map optional and test nullable behavior before adding fixture values.

## Migration Plan

1. Add additive columns and idempotent schema checks.
2. Extend normalization, read models, mutations, and templates with nullable metadata.
3. Add focused validation, age, rendering, and migration tests.
4. Populate only the sanitized preview fixture with reviewed metadata values.
5. Verify preview and health checks; production remains unchanged until separately approved.
