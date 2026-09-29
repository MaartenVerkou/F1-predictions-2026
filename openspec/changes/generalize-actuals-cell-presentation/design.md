## Context

The current Actuals read model creates separate full-value, line-array, and display-line representations. The template renders each display line as a block, while a compact-code class disables wrapping. The table then uses auto layout and several width overrides, so the same answer can be clipped at one viewport and wrap at another. The change must remain presentation-only: stored evidence, actual snapshots, scoring, and canonical answer values are not changed.

## Goals / Non-Goals

**Goals:**

- Give the Actuals table one shared cell-display contract for scalar values, structured values, and entity collections.
- Keep complete values available through title and ARIA metadata while bounding visible content to two lines.
- Use one compact responsive mode rather than a chain of 400/500/720px exceptions.
- Make race headers, review markers, and answer cells use the same plain border and wrapping primitives.
- Remove redundant formatters and CSS rules after behavior parity is proven.

**Non-Goals:**

- Changing derivation semantics, scoring, stored snapshot values, or database schema.
- Rewording questions or changing canonical driver/team identities.
- Adding a new responsive table variant for every device size.

## Decisions

### 1. One projection object at the Actuals boundary

Replace the parallel answer-formatting paths with one shared projection function. It receives the raw stored value and question/view metadata and returns:

- `fullText`: the canonical readable value for title and ARIA;
- `displayText`: one compact string for the visible cell;
- `kind`: a small semantic category such as `scalar`, `entities`, or `metric`;
- `overflowCount`: optional count represented by `+N`.

Entity collections are deduplicated before compaction. Collections with more than two entities use stable three-character driver/team codes; scalar numbers, statuses, and short values stay readable. The projection never switches on a question ID. A DNF total or other interpretation belongs in the derivation result, not in table presentation.

An alternative was to keep an array of pre-wrapped display lines. That was rejected because the browser cannot reflow those lines consistently when cell width changes.

### 2. One value block and one wrapping policy

The template renders `displayText` in one value block. The block uses normal whitespace, `overflow-wrap:anywhere`, and a two-line clamp. Code styling may adjust typography only; it must not change wrapping. Pending review is represented by one compact marker in the race header, with the full meaning in its title and ARIA label; pending and reviewed cells retain the same plain border treatment.

The full value remains in `title` and `aria-label`. The visible projection may therefore be compact without losing inspectability or accessibility.

### 3. Two responsive modes with fluid compact widths

Use normal mode above the compact threshold and compact mode at or below it. Compact mode switches to the short question label and uses fluid CSS `clamp()` widths for the question and race/value columns. This gives a smooth fit between phone and tablet widths without separate 400px/500px rules.

Normal mode keeps the full question prompt and the standard shared value width. Compact mode keeps the same table structure, the same projection, and the same two-line policy; only the label and shared widths change.

An alternative was to add more breakpoint-specific selectors. That was rejected because each new width would create another way for headers, statuses, and values to diverge.

### 4. Keep the table's horizontal scroll local

The overview table remains wider than a phone when it has many race columns, but the scroll is contained by the table wrapper. The document itself remains overflow-safe. Shared width variables apply to both header and body cells so auto table layout cannot make one of them wider than the other.

### 5. Test behavior, not implementation shape

Unit tests cover the projection contract and representative answer shapes. Layout tests assert the shared CSS contract. Playwright checks 390px, 600px, 720px, and 1440px for visible wrapping, two-line bounds, accessible full values, local scrolling, and console errors. A before/after value comparison confirms that only presentation changes.

## Risks / Trade-offs

- **Risk:** A compact token sequence may wrap at an unexpected separator. → Use spaces around separators, allow natural wrapping, and retain the complete value in hover/ARIA text.
- **Risk:** Removing per-question formatting exposes an unsupported raw answer shape. → Add a generic JSON/scalar fallback and keep the cell marked inspectable rather than inventing a value.
- **Risk:** A two-line clamp hides part of a long answer. → Preserve the full answer in title/ARIA and keep the overflow count in the compact projection.
- **Risk:** Existing tests depend on the line-array shape. → Update tests at the public display boundary and remove obsolete implementation assertions in the same change.

## Migration Plan

1. Add projection and responsive-layout regression tests against the current preview behavior; observe the expected failure for clipped code lines.
2. Implement the single projection and one-block template rendering.
3. Replace competing Actuals width and wrapping rules with shared normal/compact variables.
4. Run targeted tests, full tests, and Playwright at all four representative widths.
5. Rebuild the isolated preview and verify health/PostgreSQL connectivity; production remains untouched.
6. If a regression appears, roll back the preview image/commit. No database migration or data rollback is required.
