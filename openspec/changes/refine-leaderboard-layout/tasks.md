## 1. Movement Column

- [ ] 1.1 Replace unchanged movement `0` with a muted compact placeholder while preserving signed mover values.
- [ ] 1.2 Narrow the movement column and replace the visible `CHANGE` header with a compact accessible header.
- [ ] 1.3 Update e2e assertions for mover, non-mover, and accessible column behavior.

## 2. Layout And Visual Hierarchy

- [ ] 2.1 Move selected participant details below the full-width leaderboard table on desktop.
- [ ] 2.2 Reduce nested panel/card styling in selected details while keeping sections scannable.
- [ ] 2.3 Keep desktop, phone, light mode, and dark mode layouts readable without page-level horizontal overflow.

## 3. Verification And Release

- [ ] 3.1 Run `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e`.
- [ ] 3.2 Run `openspec validate refine-leaderboard-layout --type change --strict`.
- [ ] 3.3 Run browser visual checks for desktop/mobile and light/dark leaderboard layouts.
- [ ] 3.4 Archive the OpenSpec change, merge to `main`, push, and watch CI/deploy.
