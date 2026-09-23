## Context

The admin inputs view already uses one table shell and bounded scroll wrappers, but table-specific minimum widths and unlabelled team metadata make the compact rows harder to scan. The existing `admin-interface` capability already requires no document-level overflow, so this change tightens that contract for the four input tables without changing their data or mutation routes.

## Goals / Non-Goals

**Goals:**

- Make team metadata understandable at a glance and consistent across locales.
- Keep primary table content visible while allowing dense secondary columns to wrap or scroll inside the table region.
- Establish shared CSS rules rather than four independent responsive hacks.
- Preserve row selection, editor placement, table semantics, and existing data values.

**Non-Goals:**

- No schema or seed-data changes.
- No change to the meaning of team codes, country codes, entry years, or power units.
- No redesign of the actuals, race-data, or public-facing tables.

## Decisions

1. **Use plain `since {year}` wording.** The year is a team-history fact; the `F1` prefix adds no information and is confusing. A localized label is clearer than a bare year while remaining compact.
2. **Keep power unit as a secondary token.** It is useful for the relevant questions, but it stays visually subordinate and may be omitted when absent. The token uses the existing localized short label so it can evolve independently.
3. **Use one responsive input-table contract.** Drivers, teams, races, and mappings retain their useful minimum widths in a scroll container. Cell-level `min-width: 0`, wrapping/truncation for secondary content, and `overflow-wrap` prevent individual values from forcing page overflow. This is preferable to hiding columns because all operational data remains available.
4. **Separate responsive behavior from data markup.** Add shared classes to the existing table wrappers/metadata, then use one media-query block for input tables. No per-row inline styles or JavaScript layout decisions are needed.

## Risks / Trade-offs

- [Risk] Very narrow screens still require horizontal scrolling for the full table. → Mitigation: keep the scroll region bounded, preserve the primary name/action columns, and make secondary metadata wrap or ellipsize.
- [Risk] A localized translation could become longer than the compact English token. → Mitigation: use the existing short-label namespace and test the rendered template for wrapping rather than assuming fixed widths.
- [Risk] Hiding power-unit metadata might make relevant data harder to discover. → Mitigation: retain it in the secondary line and editor; only reduce its visual weight.

## Migration Plan

1. Update locale labels, shared input-table markup classes, and responsive CSS.
2. Run focused template/style tests and the full test suite.
3. Rebuild and seed the isolated preview, then verify all four input tabs at desktop and narrow viewport widths.
4. Rollback is a normal image rollback because no persistent data or schema changes are introduced.
