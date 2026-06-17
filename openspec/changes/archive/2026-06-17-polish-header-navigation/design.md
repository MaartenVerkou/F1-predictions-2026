## Context

The header is shared by public, authenticated, and admin pages. It currently renders primary navigation, account state, language selection, and theme switching in one cluster, with separate styling paths for links, details summaries, and buttons.

The collapsed phone layout should prioritize the actions users need most, while the desktop layout should stay compact and recognizable.

## Goals / Non-Goals

**Goals:**
- Make the collapsed menu order predictable: Admin, Dashboard, Account, Language, Theme.
- Present Account as a normal icon/action instead of signed-in status copy.
- Keep Dashboard icon plus text where the header has room.
- Normalize hover, focus, and active styling across header links, language controls, and theme controls.
- Keep selected states subtle in dark mode.

**Non-Goals:**
- No route, authentication, locale, or theme persistence changes.
- No new icon library or frontend dependency.
- No redesign of the brand, countdown, or page-level navigation.

## Decisions

- Use existing inline SVG/icon-mask patterns instead of adding a dependency.
  - Rationale: the header already uses inline SVGs and mask icons, so this keeps the change small and production-safe.
  - Alternative considered: add lucide icons. Rejected because the app does not currently depend on a client icon package.
- Treat header controls as one visual component family.
  - Rationale: links, summary controls, and buttons should have the same target size, spacing, hover, focus, and active background in the menu.
  - Alternative considered: keep separate styling for language and theme. Rejected because it caused the inconsistent appearance called out by the user.
- In collapsed layout, use CSS order rather than route-specific conditional rendering.
  - Rationale: template order stays logical and accessible, while mobile presentation can prioritize Admin and Dashboard.

## Risks / Trade-offs

- CSS specificity could accidentally affect non-header buttons -> Scope new rules under header-specific classes and collapsed header selectors.
- Long localized labels could crowd the desktop header -> Preserve the existing responsive collapse behavior and allow Dashboard text to hide when space is constrained.
- Active language styling could still read too strongly in dark mode -> Use muted border/background treatment instead of accent-red filled state.
