## Context

The current leaderboard page renders chart, ranking table, and selected participant details in separate nested panels. On desktop, the table and detail panel sit side by side, which makes the ranking feel squeezed and creates a board-within-board effect. The latest-race movement column also shows `0` for unchanged rows, making non-movers compete visually with meaningful movers.

## Goals / Non-Goals

**Goals:**
- Make actual rank movers stand out by muting or replacing unchanged movement values.
- Keep the movement column compact and avoid a wide text header.
- Use a conventional vertical hierarchy: trend chart, full-width ranking table, selected participant details below.
- Flatten the selected details styling so it reads as supporting information rather than a separate side board.
- Keep desktop and phone layouts readable in light and dark mode.

**Non-Goals:**
- Changing scoring or latest-race delta calculations.
- Removing selected participant insights or question breakdowns.
- Changing the public/private access contract.
- Reworking unrelated dashboard or home-page leaderboard previews.

## Decisions

### Use a compact movement glyph and accessible label

Unchanged rows SHALL show a muted dash rather than `0`, while positive and negative rank movement retains signed text. The column header will be visually compact but retain an accessible label for screen readers.

Alternative considered: hiding the column for unchanged rows only. That would cause inconsistent table structure and make scanning harder.

### Put details below the leaderboard on desktop

The selected participant panel SHALL sit below the ranking table, not beside it. This gives the ranking table the expected primary position and makes details feel like drill-down context.

Alternative considered: keeping side-by-side layout and widening the table. That still creates two competing focus areas and does not solve the nested-board feeling.

### Flatten detail-panel visuals instead of removing structure entirely

The details area will keep headings, metrics, insight groups, and breakdown controls, but use lighter borders and fewer heavy panel surfaces.

Alternative considered: rendering all detail content as plain text below the table. That would reduce containers, but it would make dense question breakdown content harder to scan.

## Risks / Trade-offs

- Users may wonder what the dash means -> Mitigate with an accessible label and the surrounding movers making signed values clear.
- Details below the table require more vertical scrolling -> Mitigate by giving the table full width and keeping the detail section compact.
- Flattening cards too much could reduce separation -> Mitigate with subtle top borders and consistent spacing.
