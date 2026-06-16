## Context

The leaderboard page currently places the ranking table and chart side by side, then renders a large selected-participant detail panel below. This makes the page read as a table with a companion chart, while the user's desired hierarchy is trend first, standings second, explanation third.

The chart legend already contains checkboxes that toggle chart series visibility. Because the checkbox sits inside a label, clicking the visible legend row currently toggles visibility rather than selecting the participant.

## Goals / Non-Goals

**Goals:**

- Put the points-over-rounds chart at the top of the leaderboard content.
- Put the chart legend to the right of the curve on desktop so it works as a compact participant rail.
- Make legend row clicks navigate/select the participant while only checkbox clicks change plotted visibility.
- Keep desktop and phone layouts readable in light and dark mode.
- Preserve existing selected participant insights and breakdown behavior.

**Non-Goals:**

- No scoring model changes.
- No changes to actual snapshot generation.
- No new charting dependency.
- No change to public/private leaderboard access rules.

## Decisions

- Use existing server-rendered SVG and EJS data rather than introducing a chart library. This keeps the deployment surface small and avoids adding client-side rendering failure modes.
- Replace legend `<label>` rows with a row containing an explicit checkbox and a link. This separates checkbox activation from participant selection while preserving accessible checkbox names.
- Use a two-tier layout: top trend section, then a below grid with ranking table and selected details. This gives the chart the first read without making the selected details dominate the page.
- Keep the full question breakdown in the selected details area. It remains available through the existing scored/all toggle and continues to be locked for anonymous visitors.

## Risks / Trade-offs

- Chart-first layout may push the ranking table lower on phone screens. Mitigation: stack chart, compact legend, table, then details with responsive spacing.
- A link inside each legend row adds another navigation target. Mitigation: keep the checkbox visually and semantically distinct, and ensure tests cover that checkbox clicks do not navigate while link/row clicks select.
- The participant rail duplicates some leaderboard data. Mitigation: keep it compact and graph-scoped rather than another full table.
