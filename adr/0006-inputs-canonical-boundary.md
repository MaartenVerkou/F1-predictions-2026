# ADR 0006: Inputs as the canonical boundary for evidence, actuals, and scoring

Date: 2026-09-23

## Status

Proposed

## Context

The application now has canonical season Inputs, normalized race evidence, actual snapshots, and canonical answer helpers, but the boundaries are not yet enforced consistently. Actual derivation is duplicated in route and backfill code, scoring has multiple callers with overlapping logic, and live actuals are not fully season-scoped. A label change, mid-season lineup replacement, provider correction, or second season can therefore produce different interpretations depending on which page or script is used.

## Decision

Treat the resolved season Inputs catalog as the canonical semantic boundary. It owns stable driver, team, and race identities; season membership and order; round-bounded seat assignments; calendar and season metadata; aliases; provider references; and a deterministic catalog revision.

Keep three downstream layers separate and version-linked:

1. **Evidence** is immutable normalized observation with source labels, coverage, cutoff, provider identity, and catalog revision.
2. **Actuals** are derived or explicitly corrected values with evidence revision, catalog revision, derivation version, review state, and a season-scoped published pointer.
3. **Scoring** is a shared pure service that consumes canonical responses and the selected season's published actual snapshot.

Every page and job uses these shared contracts. Display labels are never semantic keys, unresolved mappings are never guessed, and later Input edits do not rewrite historical evidence, actuals, or scoring results.

## Consequences

- Renames and lineup changes remain stable and round-aware across Questions, Race data, Actuals, and scoring.
- Race audits can reproduce exactly which evidence and catalog revision produced a derived value.
- Multiple seasons can be scored independently without global actual-state leakage.
- The application must carry revision/provenance metadata and preserve a temporary legacy compatibility path.
- The duplicated derivation and scoring paths must be removed only after old-vs-new parity tests pass.
- Admin UI can remain compact because source context is available on demand rather than repeated in every table.

## Alternatives Considered

- **Keep each route self-contained:** rejected because route-specific name matching and derivation already diverge.
- **Make provider data the canonical model:** rejected because provider identifiers and labels are not stable application identity and cannot express approved historical lineup decisions.
- **Store all facts in Inputs:** rejected because observed evidence and derived values have different lifecycle, provenance, and correction semantics.
- **Keep one global live `actuals` table:** rejected because it cannot represent independent historical seasons or reproducible snapshot selection.
