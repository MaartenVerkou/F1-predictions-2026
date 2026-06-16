## 1. Access And Navigation

- [x] 1.1 Reproduce anonymous global leaderboard direct access and home-preview navigation behavior.
- [x] 1.2 Update global leaderboard entry-point href generation so anonymous visitors go directly to `/global/leaderboard`.
- [x] 1.3 Preserve private group leaderboard login protection and anonymous breakdown locking.

## 2. Presentation Polish

- [x] 2.1 Tune leaderboard panel, table, chart, legend, selected insight, and locked-breakdown styling for large screens.
- [x] 2.2 Tune phone layout to avoid incoherent overlap, cramped controls, and unreadable table labels.
- [x] 2.3 Add light/dark mode-specific contrast refinements using existing design tokens.

## 3. Verification

- [x] 3.1 Add Playwright coverage for anonymous home-preview navigation to the public global leaderboard.
- [x] 3.2 Run `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e`.
- [x] 3.3 Run `openspec validate fix-public-leaderboard-polish --type change --strict`.
- [x] 3.4 Run browser visual checks across desktop/mobile and light/dark themes.
- [ ] 3.5 Archive the OpenSpec change after verification and merge to `main` for deployment.
