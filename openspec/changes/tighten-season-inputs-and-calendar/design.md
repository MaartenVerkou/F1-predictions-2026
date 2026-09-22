## Context

The admin Inputs page is intentionally dense, but the current Teams view adds a sentence that repeats the visible period controls and the table toolbars hide edit/remove actions until a row is selected. Race rows already have a nullable `scheduled_date` field, yet the seed catalog does not populate it and the UI does not expose it. The change spans the shared admin client behavior, season-input schema, seed data, and preview database.

## Goals / Non-Goals

**Goals:**

- Keep the Inputs workflow compact while making available actions discoverable.
- Preserve disabled-state feedback for actions that require a selected row.
- Store a real start instant plus venue IANA timezone for scheduled race starts.
- Seed the existing 2026 race list from the official F1/FIA start-time publication without silently changing the app's established round numbering.
- Display the local venue start time in the Races table and retain nullable fields for future seasons.

**Non-Goals:**

- Do not add Bahrain or Saudi Arabia to the established 22-round application calendar in this change; that would renumber existing actuals/evidence and requires a separate calendar correction decision.
- Do not add session times for practice, sprint, or qualifying.
- Do not deploy production or copy production data into the preview.

## Decisions

### 1. Preserve the existing race list and enrich its schedule

Keep `data/races.json.races` as the compatibility-free list of canonical display names used by the app. Add a `calendar.2026` map keyed by those names, with `start` as an ISO UTC instant and `timezone` as an IANA venue timezone. The seed script passes these values to the existing `races.scheduled_date` field and a new nullable `races.scheduled_timezone` field. This avoids renumbering evidence while making the schedule authoritative for the current model.

Alternatives rejected: replacing the `races` array with objects would require changing multiple roster/results consumers; storing local wall-clock strings without a timezone would make later display and export ambiguous.

### 2. Format local time at the presentation boundary

The Races table formats the stored instant using the race's IANA timezone and the current interface locale, with a short `—` state when no schedule exists. The table marks the value up with a `<time>` element and exposes the timezone in the title. This keeps storage normalized while showing the local start time published by F1/FIA.

### 3. Keep table actions visible

Remove `data-hide-until-selection` and the associated client hiding logic. Actions remain in the toolbar, disabled when no row is selected and enabled after selection. Capabilities still control whether an action exists at all.

### 4. Tighten only the Inputs rhythm

Remove the redundant Teams helper paragraph, reduce the Inputs card gap, and keep toolbar/table margins at zero or a small consistent separation. Shared table borders and row padding remain unchanged so the density improvement does not reduce readability.

## Risks / Trade-offs

- **Published calendar changes later** → keep the schedule map versioned by season and rerun the seed/update flow; do not infer dates from round numbers.
- **A timezone identifier is unavailable or invalid** → render the stored timestamp in UTC fallback and retain the raw value for diagnosis.
- **Existing preview rows have no timezone column** → add the nullable column during startup normalization before seeding schedule values.
- **Visible disabled buttons add toolbar width on mobile** → allow the existing toolbar flex-wrap behavior and keep labels short.

## Migration Plan

1. Add `scheduled_timezone` to fresh SQLite/PostgreSQL schemas and add a forward-only nullable column migration.
2. Add the 2026 schedule map and update season seeding/copying and route preservation to carry both schedule fields.
3. Remove redundant guidance, make table actions visible-disabled, and add the Races start column.
4. Run focused and full tests, rebuild the sanitized preview, run the seed update for 2026 and copied preview seasons, and verify the table in the browser.
5. Production remains unchanged. Rollback is a preview rebuild to the prior commit; schedule values are additive and nullable.

## Open Questions

- A future change should decide separately whether the app's existing 22-round calendar should be replaced by the published 24-round 2026 calendar, since doing so would renumber stored race evidence and actuals.
