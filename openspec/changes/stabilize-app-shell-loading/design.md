## Context

The app is a server-rendered Express/EJS site. Each route change is a full document navigation, so the shared head, CSS, fonts, images, and header bootstrap determine whether the page appears as one stable render or as a sequence of visible corrections.

Diagnosis on June 18, 2026 found:
- `/styles.css`, `/app.js`, and brand assets are served with `Cache-Control: public, max-age=0`, causing repeat navigations to revalidate critical assets.
- The shared head depends on Google Fonts during render. When font files are delayed, dashboard heading height changes from 43px to 40px and layout shift appears in cards/header content.
- `logo-header-light.png` is 390KB and `logo-header-dark.png` is 334KB despite rendering at 50x50px in the header.
- Recent header offset work made the fixed header stable, but page typography and asset delivery still lack an app-wide contract.

## Goals / Non-Goals

**Goals:**
- Make full-document route changes render with stable typography and stable section dimensions.
- Avoid late webfont metric swaps as a normal page-load path.
- Cache versioned static assets long enough that repeat navigation does not repeatedly revalidate CSS, JS, fonts, or brand images.
- Reduce critical header asset weight.
- Add regression coverage that simulates slow fonts/assets and asserts layout stability budgets.

**Non-Goals:**
- No SPA conversion, client-side router, or artificial transition layer.
- No animation/delay masking for layout instability.
- No visual redesign of pages, header navigation, or leaderboard content.
- No database, authentication, scoring, or locale behavior changes.

## Decisions

1. Use locally served font assets or system-font fallback, not live Google Font delivery as a render dependency.
   - Rationale: the user-visible symptom is a font metric swap. A deterministic local font path plus preload/cache, or a deliberate system stack, removes the network race.
   - Alternative considered: keep Google Fonts and rely on `display=swap`. Rejected because it explicitly permits the fallback-to-webfont swap the user is reporting.
   - Alternative considered: hide text until fonts load. Rejected because it masks the issue and hurts perceived performance.

2. Add URL-versioned asset helpers before enabling long-lived cache headers.
   - Rationale: `immutable` caching is only safe when the URL changes as content changes. A server-side helper can append a startup-computed content version to `/styles.css`, `/app.js`, fonts, and critical brand assets.
   - Alternative considered: set long cache on existing stable paths. Rejected because users could keep stale CSS/JS after deploy.

3. Keep server-rendered navigation but make the shared shell stable.
   - Rationale: the app is small and server-rendered; a SPA shell would be a larger architectural shift than needed. The professional fix is to make each document render stable and cached.
   - Alternative considered: client-side partial navigation. Deferred because it introduces router state, error handling, and accessibility work beyond the observed issue.

4. Optimize header-critical brand images separately from social/marketing images.
   - Rationale: a 50px header logo should not load a 300-400KB source. Keeping dedicated header assets avoids changing OG images or other brand media.

5. Treat layout stability as a tested production requirement.
   - Rationale: the bug is perceptual and easy to regress. Playwright should simulate delayed fonts/assets and assert CLS and key dimensions instead of only checking final layout.

## Risks / Trade-offs

- Local font files add repo assets -> Keep only required weights/styles and prefer WOFF2.
- Long-lived cache can serve stale assets if versioning is incomplete -> Require all shared head asset URLs to use the helper and add a build check.
- System font fallback may slightly change brand feel if chosen over self-hosting -> Prefer self-hosting existing Sora/Manrope unless asset size or licensing blocks it.
- Image optimization could alter logo appearance -> Verify screenshots in light/dark header before deploy.
- Performance tests can be flaky if budgets are too strict -> Use stable synthetic delayed-font tests with moderate thresholds and explicit dimension checks.

## Migration Plan

1. Add asset versioning helper and update shared head references.
2. Configure Express static caching for versioned assets and no-store/no-cache where appropriate for HTML.
3. Add deterministic font delivery and remove render dependency on Google Fonts.
4. Add optimized header logo assets and switch the header to them.
5. Add Playwright navigation-stability coverage.
6. Run local lint/unit/build/e2e plus browser screenshots; deploy through the existing GitHub Actions workflow.
7. Rollback by reverting the change; asset URLs and cache versions will move back with the reverted commit.
