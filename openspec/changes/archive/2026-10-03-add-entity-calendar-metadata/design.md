## Context

The canonical season-input tables already own teams and races, and the admin inputs page is their maintenance surface. Team names have multiple historical lineages, so a single ambiguous founding date would be misleading; the model will use first F1 season and label it explicitly. Race start timezone already exists and will be surfaced alongside new race identity and venue fields.

## Goals / Non-Goals

**Goals:**

- Keep metadata on the canonical team and race records so all consumers share one source of truth.
- Normalize values at the domain boundary and migrate existing SQLite/PostgreSQL installations additively.
- Seed researched 2026 metadata while allowing future seasons to remain partially populated.
- Keep the admin table compact by showing metadata as secondary text instead of adding wide columns.

**Non-Goals:**

- Reconstructing full team lineage or renames; aliases and stable IDs remain the mechanism for that.
- Treating team base country as sporting nationality or driver nationality.
- Changing race schedule timing, actuals, evidence, or assignment logic.

## Decisions

Add nullable columns to `teams`: `team_code`, `base_country_code`, and `f1_entry_year`; add nullable columns to `races`: `race_code`, `country_code`, and `circuit_name`. The existing `scheduled_timezone` remains the IANA timezone for the scheduled start. Optional values are preserved when an older seed path omits them and are normalized when supplied.

Use the official Formula 1 2026 team and calendar pages as the seed source. Team history uses first F1 season rather than a contested founding year, especially for rebranded lineages such as Alpine, Aston Martin, Audi, and Racing Bulls.

Render metadata beneath the primary team/race name and expose the fields in the existing editors. This keeps the table readable while making the values discoverable and maintainable.

## Risks / Trade-offs

- [Team code conventions vary by provider] → Treat codes as canonical app identifiers, not provider keys; provider references remain separate.
- [A team's base or lineage can have multiple valid interpretations] → Label the field `Base` and use `F1 since`; keep both nullable and document the scope.
- [External calendar data changes] → Seed files remain the editable source and no production rewrite is performed in this change.

## Migration Plan

Deploy additive schema columns, then run the existing preview season seed to populate known values. Existing rows and IDs remain intact; rollback is a code revert and the nullable columns can remain unused.
