## Context

The season-input model already stores driver nationality and team code metadata, but nationality and team identifiers were normalized with two-letter or variable-length rules. Team records are also the canonical home for lineup context and are the right place for a 2026 power-unit supplier used by questions and analysis.

## Goals / Non-Goals

**Goals:**

- Use three-letter uppercase F1-style nationality and team codes at the domain boundary.
- Migrate the 2026 seed values without changing stable entity IDs, assignments, or historical snapshots.
- Add a nullable `power_unit` team field with additive SQLite/PostgreSQL migration support.
- Keep the existing compact table pattern and row editors, with localized labels and no extra wide columns.

**Non-Goals:**

- Introducing a separate power-unit entity or modelling supplier contracts over time.
- Re-keying provider mappings, question answers, race actuals, or driver-team assignment intervals.
- Reconstructing historical power-unit changes outside the seeded season.

## Decisions

- Add `power_unit TEXT` to `teams`; keep it nullable because future and historical seasons may lack a researched value.
- Add `normalizeNationalityCode` validation for exactly three A–Z characters and add `normalizeTeamCode` for exactly three A–Z characters. Keep race codes on the existing entity-code rule because their current canonical values are already three-letter and the request concerns teams and driver nationality.
- Seed the F1 display codes (for example `GBR`, `ITA`, `NED`) rather than raw ISO-2 country codes. The existing `base_country_code` remains ISO-2 and keeps its distinct geographic meaning.
- Seed 2026 power units from the official F1 2026 technical overview: Mercedes powers Mercedes, McLaren, Williams, and Alpine; Ferrari powers Ferrari, Haas, and Cadillac; Red Bull Ford powers Red Bull Racing and Racing Bulls; Honda powers Aston Martin; Audi powers Audi.
- Render team metadata as one secondary line (`TEAM · BASE · F1 YEAR · POWER UNIT`) so table width stays stable. The editor uses one additional labeled input.

## Risks / Trade-offs

- [F1 display codes are presentation conventions, not universal ISO identifiers] → Name the field as F1 nationality/code in the UI and preserve base-country ISO-2 separately.
- [Power-unit suppliers can change between seasons] → Store the value on the canonical team record for now, with nullable data and no assignment logic coupling; a future season-specific supplier table can be added if needed.
- [Old clients may submit two-letter nationality values] → Treat this as a forward-only development change; validation fails clearly and the 2026 seed migrates existing known values.

## Migration Plan

1. Add nullable team power-unit columns and update normalization rules.
2. Seed 2026 three-letter nationality/team codes and power units through the existing idempotent seed.
3. Rebuild and seed the isolated preview database, run tests and UI checks, and leave production unchanged.
4. Rollback is a code revert; additive nullable columns can remain unused.
