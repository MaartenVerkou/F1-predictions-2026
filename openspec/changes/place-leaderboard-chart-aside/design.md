## Context

The leaderboard page currently renders the points-over-rounds graph as a full-width section above the ranking table. The selected-participant detail panel was recently moved below the table because it competed with the leaderboard when placed beside it.

## Goals / Non-Goals

**Goals:**
- Make the graph a desktop companion to the leaderboard instead of a blocker above it.
- Keep the ranking table as the dominant surface.
- Keep selected-participant details below the table/chart row.
- Preserve mobile readability, theme support, and existing chart interactions.

**Non-Goals:**
- Changing scoring, chart data, selected participant logic, or access rules.
- Redesigning the selected participant insights or question breakdown.

## Decisions

- Use a responsive grid wrapper around the table and chart. On wide screens, the table uses the larger column and the chart uses a narrower aside; below the desktop breakpoint, the layout stacks.
- Keep the graph visually lighter than the table. It may have spacing and a divider, but it should not become a heavy nested dashboard card.
- Move the chart in the DOM near the leaderboard table so keyboard and reading order match the visual relationship.
- Keep selected details as a separate follow-up section under the desktop row.

## Risks / Trade-offs

- Narrow desktops could squeeze the chart if the breakpoint is too low -> Use a desktop-only two-column breakpoint and allow the chart SVG to scale down inside its aside.
- The graph legend could become dense in a narrow aside -> Use a compact single-column legend on desktop aside widths and retain wrapping on stacked layouts.
- Moving DOM order could affect anchors -> Preserve `#leaderboard-overview` and existing participant links.
