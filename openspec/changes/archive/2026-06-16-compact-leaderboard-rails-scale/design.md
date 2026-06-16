## Context

The trend-first leaderboard currently uses fixed-ish desktop space for participant rails: the chart legend gets a 220-260px column, and the lower ranking/details grid uses equal columns. This makes the page feel less efficient when participant names are short. The SVG chart also maps zero to the bottom axis even when all current focus participants are far above zero, reducing vertical resolution for the comparison that matters now.

## Goals / Non-Goals

**Goals:**

- Make the chart legend width follow its content within sensible bounds so the chart receives the spare width.
- Let the ranking table occupy a compact bounded column on desktop while selected details take the remaining space.
- Scale the chart Y-axis from a rounded lower bound based on latest visible focus-set totals, with older lower scores clamped to the baseline.
- Preserve accessible labels, hover/focus behavior, mobile readability, and existing participant selection/toggle behavior.

**Non-Goals:**

- No scoring, snapshot, or participant focus-set changes.
- No charting dependency.
- No change to public/private leaderboard access.

## Decisions

- Use CSS grid intrinsic sizing (`fit-content`, bounded min/max widths, and ellipsis) rather than hard-coded spacer columns. This keeps short names compact while preventing long names from breaking the layout.
- Keep the table compact only on wide screens. Mobile layouts continue to prioritize readability and stacking.
- Compute chart domain in the server-rendered template from each plotted participant's latest point total. The lower bound is rounded down to a nice step, the upper bound rounded up, and historical values outside the domain are clamped into the plot area. This focuses the chart on current standings while preserving all series.
- Add testable data attributes for the chart domain. They are non-visual metadata and make the intended scaling behavior explicit in e2e coverage.

## Risks / Trade-offs

- A compact table can truncate unusually long participant names. Mitigation: preserve full names in link labels/tooltips and keep bounds wide enough for common names.
- A non-zero chart floor can hide how far a participant rose from earlier low scores. Mitigation: use this only for the trend chart's visual scale; point titles still expose actual values and the bottom axis label shows the floor.
- Clamping below-domain historical points can make early points share the baseline. Mitigation: the chart's purpose is current position comparison, and the lower bound is derived from the latest visible focus set as requested.
