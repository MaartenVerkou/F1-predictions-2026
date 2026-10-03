## Context

The previous change established the canonical Race Data evidence/revision model and a shared metric matrix. This change is limited to the final review interaction layer: the current round control and correction affordance are visually heavy, while the primary result table should read like a normal race classification before an administrator inspects derived metrics.

## Goals / Non-Goals

**Goals:**

- Make Season and Round a single, aligned header control.
- Keep the first table focused on canonical finish order.
- Use one selected-row toolbar action for protected corrections.
- Give the detail columns a stable, review-oriented order.
- Reuse the existing matrix/metric components for driver and constructor views and keep derivation review separate.

**Non-Goals:**

- No change to the evidence schema, revision semantics, derivation algorithms, scoring rules, or participant answers.
- No automatic publication of a correction.
- No production deployment or database migration.

## Decisions

1. **Selection is view state, not data state.** The selected row is identified by the canonical driver/entity key plus the selected snapshot id in the request. The server still revalidates that identity against the persisted snapshot before saving.
2. **One editor, not repeated row forms.** The table renders a selectable row and a single hidden/adjacent editor shell. This reduces markup and prevents row actions from changing the table's rhythm while preserving the existing protected POST route.
3. **Stable facts before derived metrics.** The detail table uses one fixed column registry. Optional evidence cells render an unavailable state in place; they do not change the table geometry based on provider completeness.
4. **Shared controls and matrix components.** Driver/constructor and metric switches remain the same semantic controls for both the primary championship table and derivation review. Only the selected view model changes; the row/cell/footer templates stay shared.
5. **Responsive fallback.** The desktop segmented controls remain available when they fit; narrow widths use compact selects with the same labels and query state. Season/round controls use a grid that can stack without horizontal overflow.

## Risks / Trade-offs

- [Risk] A selected-row edit could be lost when switching round or metric. → Keep the editor closed on navigation and include snapshot/round identity in every edit form; the server rejects stale identities.
- [Risk] A reordered column could hide an evidence field on small screens. → Keep the evidence table horizontally scrollable while keeping identity columns sticky; test at the existing 390px smoke viewport.
- [Risk] Existing deep links contain `focus` parameters. → Continue accepting them for derivation-review selection, but do not let them redefine the primary finish-order table.
