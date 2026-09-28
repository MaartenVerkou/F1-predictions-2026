## Context

The prior Race Data review workspace already has one persisted evidence payload per selected round, a shared result table, shared driver/constructor matrix rows, and query-string navigation. The current UI hard-codes a narrow result-column set and hides identity names too early. Optional session evidence may arrive in future imports without being present in older snapshots, so the view must be capability-driven rather than seeded with placeholders.

## Goals / Non-Goals

**Goals:**

- Derive the selected-round result column registry from the persisted payload while keeping a deterministic order.
- Support normal and sprint weekend session layouts without changing the evidence schema or inventing data.
- Make full names the default and compact codes a responsive presentation fallback.
- Reuse one segmented-control visual primitive for table view and content variants, with a narrow-layout select fallback.
- Keep the race result rows in Grand Prix finish order and leave review/correction semantics unchanged.

**Non-Goals:**

- Do not fetch new practice data in this UI change; providers/imports may add it later.
- Do not alter scoring, derivation formulas, canonical IDs, or persisted evidence.
- Do not add a second edit path or change snapshot review lifecycle.

## Decisions

1. **Use a presentation-time session registry.** A small pure helper will inspect `payload.practice`, `payload.practice1/2/3`, and sprint-qualifying aliases, then return descriptors only for sessions with at least one row. This keeps old snapshots valid and makes future provider additions immediately visible.

2. **Treat the first position column as Grand Prix finish order.** The header is the compact `Pos.` label with an accessible title; its values are numeric or the existing Ret/DNS/DNQ labels. We do not duplicate the same result in a second Race column.

3. **Use one row model for all session cells.** `detailRows` will hold a per-session position/status map. The existing partial loops over descriptors, so normal and sprint formats share markup and only the registry changes.

4. **Use CSS breakpoints for identity fallback.** Full labels are visible by default. The detail table switches constructor codes first, then driver codes at smaller widths; the existing horizontal scroller remains the last-resort overflow mechanism. Tooltips and ARIA keep names discoverable.

5. **Share segmented control styles and add a select fallback.** Both view and metric controls receive a shared switch class. Metric buttons remain visible at desktop widths; a GET form with the same focus values appears below the narrow breakpoint and preserves season, round, and view.

6. **Keep the detail header labels concise but explicit.** Session buttons use P1/P2/P3, Sprint Q, Sprint, and Qualifying in the visible header and a full title/ARIA label such as “Practice 1” or “Grand Prix qualifying”.

## Risks / Trade-offs

- [Risk] A future payload may encode practice sessions under a new shape → Mitigation: centralize alias normalization and omit unknown/empty sessions rather than rendering misleading columns.
- [Risk] More session columns can still exceed a very narrow viewport → Mitigation: keep the dedicated table scroller and compact identity breakpoints; do not squeeze numeric cells below readable widths.
- [Risk] Query-form fallback could drop context → Mitigation: include season, round, and view as hidden fields and cover the generated URL with a route/template test.

## Migration Plan

No data migration is required. Deploy the model/template/style changes, run focused tests and Playwright smoke checks at desktop and narrow widths, then rebuild the preview from the branch without replacing its database state. Rollback is a normal commit revert; persisted evidence is untouched.
