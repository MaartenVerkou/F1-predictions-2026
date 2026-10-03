## Context

The canonical team and race records currently store `base_country_code` and `country_code` using two-letter values, while driver nationalities and team codes already use three-letter F1-style values. Race rows currently display the full IANA timezone, which is accurate but not a useful primary label.

## Goals / Non-Goals

**Goals:**

- Normalize both country fields to three uppercase letters and seed known 2026 values.
- Keep the exact scheduled instant and IANA timezone unchanged in storage.
- Calculate the displayed UTC offset from the scheduled instant in the stored timezone so DST is correct.
- Remove only redundant race-country text from the compact table; keep country editable in the race editor.

**Non-Goals:**

- Replacing IANA zones with fixed offsets in the database.
- Changing race dates, times, status derivation, or calendar semantics.
- Adding country-name lookup tables or flags.

## Decisions

- Reuse the existing country field names but make their accepted format exactly three letters. Use the F1-style values `GBR`, `ITA`, `SUI`, `USA`, `MON`, and `UAE` where they differ from ISO alpha-3 conventions.
- Seed race countries separately from race identity codes, even when they happen to match, so future venues and naming changes do not require parsing display names.
- Add a view-local formatter that uses `Intl.DateTimeFormat(..., { timeZone, timeZoneName: 'shortOffset' })`, converts the returned `GMT` prefix to `UTC`, and renders the result in parentheses. The IANA zone stays in the existing `title` attribute.
- Keep the team base country in the team metadata line because a team's country is not reliably present in its display name; omit only the race country from the race secondary line because the Grand Prix name usually identifies it.

## Risks / Trade-offs

- [F1 country codes are presentation conventions] → Document them as F1-style values and keep them independent of provider identifiers.
- [Legacy rows can contain two-letter values] → Preview seed updates known 2026 rows; strict forward-only validation rejects new two-letter submissions.
- [Timezone offset depends on the race date] → Calculate from the scheduled instant rather than storing a fixed offset.

## Migration Plan

1. Update validators, schema-facing upserts, and 2026 seed country values.
2. Deploy the view formatter and compact metadata presentation.
3. Rebuild/seed the isolated preview and verify teams/races UI and health checks.
4. Roll back code if needed; nullable fields and stored IANA timezones remain compatible.
