## Context

The previous leaderboard insights change made `/global/leaderboard` public and hid detailed question breakdowns for anonymous visitors. Direct access now returns the public leaderboard, but one anonymous home-page render path still computes a login redirect as the leaderboard CTA. The leaderboard page also added dense UI: a trend chart, focus legend, rank table, selected insights, and breakdown/locked states. Those surfaces need to remain readable across large desktop widths, narrow phone widths, and both app themes.

## Goals / Non-Goals

**Goals:**
- Make anonymous global leaderboard entry points deterministic and direct.
- Keep private group leaderboards member-only.
- Keep anonymous users from seeing detailed prediction breakdown rows.
- Improve layout rhythm, contrast, table behavior, chart legend density, and locked prompt presentation for desktop/mobile and light/dark themes.
- Add automated and browser-level verification for the entry-point bug and responsive/theme presentation.

**Non-Goals:**
- Changing leaderboard scoring, actual snapshot selection, or insight calculations.
- Making private group leaderboards public.
- Adding new dependencies or a new design system.
- Reworking unrelated home, dashboard, or group pages beyond the global leaderboard link.

## Decisions

### Keep public access explicit at entry points

Anonymous global leaderboard CTAs SHALL point directly at `/global/leaderboard`. Login redirects remain appropriate only for protected resources, such as private group leaderboards and the detailed breakdown prompt.

Alternative considered: keep the home CTA as a login prompt and rely on direct URL access. That contradicts the public leaderboard requirement and makes sharing/discovery confusing.

### Improve existing components rather than redesigning the page

The polish will adjust the existing leaderboard panels, table, chart, legend, and locked prompt. This keeps behavior stable and avoids introducing another layout pattern.

Alternative considered: split the page into multiple new routes or tabs. That is too broad for the current regression and would slow down deployment.

### Verify presentation with browser metrics and screenshots

Automated e2e tests will cover navigation/access behavior. Browser checks will inspect desktop/mobile and light/dark rendering for horizontal overflow, missing critical elements, and obvious contrast/layout regressions.

Alternative considered: rely only on e2e DOM assertions. That would miss the visual issues the user is explicitly calling out.

## Risks / Trade-offs

- Dense leaderboard tables can still require horizontal scrolling on very narrow phones -> Mitigate by tightening column widths and improving wrapped text without hiding essential data.
- Chart focus sets can produce a crowded legend -> Mitigate with compact grid sizing and stronger selected/current visual treatment.
- Theme-specific color tweaks can drift from global tokens -> Mitigate by using existing CSS variables and small dark-mode overrides only where needed.
