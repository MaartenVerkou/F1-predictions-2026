## Why

Users see full-page navigation build up in visible phases: fallback typography appears first, then the intended font and sizing arrive, and sections can shift as assets and client-side measurements settle. This should be handled at the app foundation level rather than hidden with animation or page-specific patches.

## What Changes

- Introduce an app-wide page loading contract for stable typography, stable static assets, and measurable layout stability across document navigations.
- Replace dependency on live Google Font delivery during page render with a deterministic font strategy that avoids late metric swaps.
- Add production-grade static asset caching/versioning so repeat navigation does not revalidate core CSS, JS, fonts, and brand assets on every page.
- Right-size header-critical brand assets so a 50px logo does not download hundreds of kilobytes.
- Add Playwright coverage that intentionally stresses slow font/asset paths and fails if navigation produces avoidable layout shift or unstable core dimensions.

## Capabilities

### New Capabilities
- `stable-page-loading`: App-wide requirements for smooth full-document page loads, asset caching, font stability, and layout-shift budgets.

### Modified Capabilities
- None.

## Impact

- Affected application code: Express static asset middleware in `server.js`, shared HTML head in `views/partials/header.ejs`, shared styles in `public/styles.css`, and production asset checks in `scripts/check-production-assets.js`.
- Affected assets: header logo files and any locally hosted font files added under `public/assets`.
- Affected tests: Playwright layout/performance coverage for page navigation and delayed font/asset loading.
- No database, scoring, authentication, or public API changes.
