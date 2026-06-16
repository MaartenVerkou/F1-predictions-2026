## Context

The leaderboard route already computes scored rows from responses and either live actuals or a selected actual snapshot. The app now stores per-round `actual_snapshots`, so the same scoring logic can be replayed for each completed round to show score history.

The current leaderboard view shows a paginated rank table, snapshot selector, and question breakdown for rows on the visible page. It does not yet provide historical trend context, explain why a participant is ahead or behind, or surface recent score movement after the latest race.

## Goals / Non-Goals

**Goals:**
- Show a points-over-time chart for the leaderboard focus set: current top 10 plus the logged-in participant and selected participant when outside the top 10.
- Default the selected participant to the logged-in participant when they have a scored row, otherwise P1.
- Keep the logged-in participant and selected participant visible and visually emphasized in the chart.
- Explain the selected participant's position using question-level score gaps, strengths, and distinctive predictions against nearby competitors.
- Show compact latest-race rank movement from the latest completed round compared with the previous round directly in leaderboard rows, with point-change detail in the selected participant panel.
- Let users expand a selected participant's question breakdown, defaulting to scored questions with a toggle to all questions.
- Let anonymous visitors view the global leaderboard while requiring login for private group leaderboards and detailed prediction breakdowns.

**Non-Goals:**
- Changing how questions are scored.
- Adding new persisted leaderboard tables or background jobs.
- Replacing the admin analysis and simulation tooling.
- Adding live real-time updates while a user is viewing the page.
- Introducing an external analytics or charting service.

## Decisions

### Derive trends from existing actual snapshots

The server SHALL compute historical leaderboard states by replaying existing scoring logic against the latest saved snapshot for each configured round.

Rationale: actual snapshots are already the source of truth for "how the leaderboard stood after a race." Reusing the same scoring logic avoids a second scoring model and keeps corrected snapshots reflected in the chart.

Alternative considered: persist precomputed leaderboard history. That would be faster for very large groups, but it adds invalidation complexity when admins correct actuals. With at most 24 rounds and small group sizes, on-request calculation is acceptable.

### Keep chart data server-computed and render without a heavy chart dependency

The route SHALL provide a compact chart model to the EJS view. The first implementation SHOULD render the chart with semantic HTML/SVG and light client-side enhancement rather than adding a charting package.

Rationale: the app is server-rendered and already avoids heavy frontend dependencies. A simple points line chart is enough and keeps CI/deploy surface smaller.

Alternative considered: use Chart.js or another chart package. That could speed up chart interactions but adds bundle/dependency maintenance for limited benefit.

### Use current ranking to choose the focus set and comparison band

The focus set SHALL be based on the currently viewed scoring state. The current top 10 are always included; the logged-in participant and selected participant are added when outside that top 10.

Insights SHALL compare the selected participant with a nearby band of up to five ranked participants above and five ranked participants below. For P1, the comparison band SHALL use the next ranked participants below them.

Rationale: users need context around the classement they are looking at now. A nearby band is more actionable than comparing every participant against everyone else, while still explaining why the selected participant is above or below relevant peers.

Alternative considered: compare everyone only against P1. That is simple but weak for mid-table users because it mostly explains why they are not winning, not what separates them from nearby competitors.

### Treat latest-race movement as latest-vs-previous snapshot deltas

Latest-race movement SHALL compare the latest available actual snapshot against the immediately previous snapshot for the same season. The leaderboard table SHALL show a compact rank-change value only, while the selected participant panel SHALL show the more specific point-change detail.

Rationale: this keeps the leaderboard scannable while still giving detailed score-change context where the user is already focused on one participant.

Alternative considered: show score movement across arbitrary date ranges. That can come later if users need it; latest race movement is the highest-value first step.

### Keep question breakdown focused by default

The selected participant's expanded breakdown SHALL default to scored questions only and provide a toggle to show all questions.

Rationale: the current all-question table is comprehensive but noisy. Defaulting to scored questions supports the "why are they winning/behind" job while preserving access to the full overview.

Alternative considered: always show all questions. That preserves completeness but makes the insights panel harder to scan.

### Keep public viewing limited to the global classement

The global leaderboard SHALL be readable without login, but private group leaderboards SHALL remain member-only. Anonymous global visitors SHALL see rankings, chart context, and selected-participant summary, but SHALL NOT see detailed prediction breakdown rows.

Rationale: a public global classement is useful for sharing and discovery, while private groups and per-question predictions carry stronger privacy expectations.

## Risks / Trade-offs

- Trend computation could become expensive for very large groups -> Keep calculations bounded by configured rounds, reuse existing row builders where possible, and add focused unit tests around the data builder.
- The chart could become visually noisy with top 10 plus emphasized participants -> Use muted baseline styling for ordinary top-10 lines and stronger treatment for selected/logged-in participants.
- Insight language could overstate causality -> Use concrete wording based on scored point differences and distinctive predictions, not speculative explanations.
- Corrected historical snapshots can change prior trends -> This is desired behavior because admin corrections should update the historical classement; the page should clearly indicate the selected snapshot/live source.
- Empty or sparse early-season data could make panels look thin -> Provide clear empty states when there are fewer than two snapshots or no scored questions.

## Migration Plan

No database migration is expected. Deploying the feature is a code-only rollout. Rollback is the standard GitHub Actions rollback path: deploy a previous commit and continue using the existing leaderboard without historical panels.

## Open Questions

- Whether to add a future chart mode for per-round points gained. The first implementation will keep total points as the chart default and surface point gains through tooltips and the selected participant detail panel.
