## 1. Baseline And Test Harness

- [ ] 1.1 Add Playwright coverage that simulates delayed font files during home-to-dashboard navigation.
- [ ] 1.2 Assert navigation CLS, header offset stability, heading dimensions, and primary card dimensions.
- [ ] 1.3 Add checks for static asset cache headers and versioned shared head asset URLs.

## 2. Versioned Static Asset Delivery

- [ ] 2.1 Add a server-side asset URL helper that appends a content-based version to shared static assets.
- [ ] 2.2 Update shared head references for CSS, JS, fonts, and header brand images to use the helper.
- [ ] 2.3 Configure Express static middleware with long-lived immutable caching for versioned public assets.
- [ ] 2.4 Keep HTML responses dynamic and avoid caching user/session-specific pages.
- [ ] 2.5 Extend production asset checks to fail when shared head assets bypass the versioning helper.

## 3. Deterministic Typography

- [ ] 3.1 Add deterministic local font delivery or switch to a deliberate system font stack.
- [ ] 3.2 Remove render-path dependency on Google Fonts from the shared head.
- [ ] 3.3 Preload/cache any local font files used for core typography.
- [ ] 3.4 Verify delayed or unavailable external font providers do not change page dimensions.

## 4. Header-Critical Image Optimization

- [ ] 4.1 Create right-sized light and dark header logo assets for the rendered header size.
- [ ] 4.2 Switch the header logo to the optimized assets while preserving explicit dimensions.
- [ ] 4.3 Verify light and dark header screenshots still render the intended brand mark.

## 5. Verification And Rollout

- [ ] 5.1 Run lint, unit tests, build checks, and the full Playwright suite.
- [ ] 5.2 Run a local browser check for home, dashboard, account, and leaderboard navigation.
- [ ] 5.3 Document before/after measurements in the change notes or final summary.
- [ ] 5.4 Deploy through the existing GitHub Actions workflow after implementation is complete.
