## Context

The canonical Race Data page already renders persisted evidence, an auditable correction editor, shared driver/constructor matrices, and a separate derivation selector. The remaining usability issue is that the review lifecycle is only obvious on Actuals, while the evidence page is where an admin actually validates the source facts. The current identity columns and question option labels also consume more width than the review task needs.

## Goals / Non-Goals

**Goals:**

- Make evidence review and snapshot publication explicit on Race Data without coupling it to a selected question.
- Reuse the existing protected review/publish lifecycle rather than adding a second status model.
- Keep corrections auditable and return the admin to the context where the correction was made.
- Provide a single compact identity formatter for driver/team tables with full-name discoverability.
- Keep the derivation selector useful but visually lightweight and responsive.

**Non-Goals:**

- No database schema change or new scoring semantics.
- No automatic review or publication without an explicit admin action.
- No removal of the Actuals overview; it remains the season-wide answer matrix.

## Decisions

1. **Review action reuses the actual snapshot route.** Race Data will submit the selected actual snapshot id to the existing review/publish operation with a validated local `returnTo` path. This keeps review status, publication, audit fields, and historical-season guards in one place instead of creating a second lifecycle.

2. **Evidence remains primary; questions remain secondary.** The question selector is rendered in the derivation section with a default neutral state. The primary evidence table and its review/correction actions do not depend on a focus id.

3. **Codes are presentation-only.** A small shared formatter derives stable three-letter display codes from canonical driver/team metadata. The DOM keeps the full name in `title` and `aria-label`; form submissions continue using canonical ids and names.

4. **Compact question labels are metadata, not data loss.** Options show the question number plus a short label and table type. The full prompt is retained in the option title and accessible description, and the selected question can be inspected without widening the whole page.

5. **Responsive width is handled by CSS, not alternate markup.** Identity columns use fixed compact widths with ellipsis, while the facts matrix keeps its existing horizontal scroller. The same templates serve desktop and narrow viewports.

## Risks / Trade-offs

- [Risk] A return path could become an open redirect → accept only paths beginning with `/admin/race-data` and fall back to `/admin/actuals`.
- [Risk] Short codes may be unfamiliar → keep full names in tooltips/accessible labels and use deterministic codes from canonical metadata.
- [Risk] A reviewed snapshot can become stale after a correction → the existing correction flow creates a new pending revision and the review action reads the latest snapshot for the selected round.

## Migration Plan

No data migration is required. Deploy the route/template/client/style changes, rebuild the sanitized preview without replacing its state directory, run the focused and full test suites, and verify both the stable preview hostname and the temporary preview hostname. Production remains unchanged until a later explicit release.
