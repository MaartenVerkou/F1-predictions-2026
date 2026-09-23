# ADR 0003: Canonical season inputs and identity references

Date: 2026-09-21

## Status

Proposed

## Context

Drivers, teams, races, question options, imported results, answers, and actuals currently exchange display-name strings. A name change or a driver/team change can therefore break matching or make a historical result appear to belong to the wrong team. The Race data audit also needs a trustworthy relationship between a driver and team for the selected round.

## Decision

Use typed canonical tables for drivers, teams, races, seasons, season membership, and round-bounded driver/team assignments. Store provider references and aliases separately. New race evidence, question options, responses, actuals, and score comparisons use canonical entity IDs; source/display labels remain as provenance and presentation data. IDs are immutable and labels are editable. Historical driver/team relationships are determined by the assignment effective for the result round.

## Consequences

- Renaming a driver or team updates every current view without rewriting historical semantic references.
- Mid-season driver changes are explicit and cannot silently rewrite earlier race results.
- Provider aliases become inspectable and correctable in one admin Inputs workspace.
- Existing name-based values require a dual-read migration and an unresolved mapping queue.
- The domain model and migration are more complex than string arrays, but scoring and audit results become deterministic and explainable.

## Alternatives Considered

- Keep string labels and expand alias constants: small initial change, but still ambiguous and unable to model historical team assignments.
- Use one generic `entities` table: fewer tables, but weaker constraints and less clear lifecycle semantics for drivers, teams, and races.
- Store provider IDs only: provider IDs are useful for resolution but are not a stable application identity across sources or provider changes.
