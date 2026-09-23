## Context

The existing admin pages already share table capability behavior, but presentation is split between view-local classes and ad hoc message placement. The change is intentionally visual and keeps route contracts, persistence, and localized message text unchanged.

## Approach

1. Identify the shared admin table shell and message partial/classes used by Inputs, Race data, Actuals, Overview, and Questions.
2. Introduce a small set of semantic classes for the table frame, header rule, first-row boundary, toolbar, and feedback context.
3. Render page feedback before the toolbar in each affected view, using `role="status"` for success/info and `role="alert"` for errors/warnings.
4. Remove duplicate local border/spacing rules so the shared contract controls the result. Keep bounded horizontal scrolling and responsive table markup.
5. Add focused view/style assertions and run the existing admin test suite plus preview smoke checks.

## Non-goals

- No schema, route, authorization, data, or localization changes.
- No redesign of table columns or action capabilities.
- No global public-facing table restyling outside the admin shell.

## Accessibility

Feedback remains discoverable to assistive technology through existing alert/status semantics. Header cells retain their scope and keyboard behavior; visual rules supplement, rather than replace, semantic table structure.
