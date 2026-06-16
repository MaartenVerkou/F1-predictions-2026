## Context

The leaderboard currently places a compact table beside a points-over-rounds chart. The chart legend duplicates leaderboard rows by listing names and point totals, and it does not give users a way to reduce visual clutter in the graph.

## Goals / Non-Goals

**Goals:**
- Preserve the table as the ranking source of truth.
- Make the chart area feel larger and less duplicated.
- Let users temporarily hide/show plotted participant series from the chart.
- Keep the controls compact, accessible, and usable in light/dark and phone layouts.

**Non-Goals:**
- Persisting chart filter choices.
- Changing which participants are initially plotted.
- Changing scoring, selected-participant routing, or leaderboard pagination.

## Decisions

- Use checkbox controls in the chart legend. Checkboxes match the binary show/hide behavior and remain accessible without inventing a custom control.
- Keep all series visible by default. JavaScript progressively enhances the controls by hiding the matching SVG line/circles when unchecked.
- Keep participant names as controls and remove latest-point totals from the legend to avoid duplicating leaderboard data.
- Use a taller chart and multi-column legend on desktop so the graph and table feel like one balanced row.

## Risks / Trade-offs

- Users without JavaScript will see checked controls that do not filter the SVG -> The graph still renders all default series, preserving the core information.
- Toggling too many series off can make the chart sparse -> This is an intentional local exploration control; users can re-check series immediately.
