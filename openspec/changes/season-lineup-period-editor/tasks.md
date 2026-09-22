## 1. Service and validation

- [x] 1.1 Add a pure team-seat history projection that groups canonical assignments by team and seat in chronological order.
- [x] 1.2 Add transactional per-team history save logic that preserves existing IDs where possible and validates the final history against all other season assignments.
- [x] 1.3 Add historical-correction detection to the team-history command and preserve the existing admin, CSRF, audit, and compatibility guards.
- [x] 1.4 Add unit tests for stable periods, mid-season replacements, empty seats, overlap rejection, duplicate-driver rejection, removals, and historical confirmation.

## 2. Admin route and view

- [x] 2.1 Replace the primary team tab's selected-round dropdown and per-round seat controls with the compact period overview and inline per-team editor.
- [x] 2.2 Add the per-team history POST route, server-side parsing, field-level validation feedback, and redirect state without changing the production route contract.
- [x] 2.3 Keep the normalized assignment/history tab read-only and remove raw IDs and race-by-race editing from the normal team workflow.
- [x] 2.4 Add progressive-enhancement controls for adding/removing period rows and selecting canonical drivers, with accessible labels and confirmation for destructive removal.
- [x] 2.5 Add localized strings and responsive/shared table styling for period chips, inline editors, empty states, and validation messages.

## 3. Verification and preview

- [x] 3.1 Add request/view tests covering permissions, CSRF, stable history rendering, replacement save, invalid submissions, and historical corrections.
- [x] 3.2 Run `openspec validate season-lineup-period-editor --type change --strict`, `npm run lint`, and `npm test`.
- [x] 3.3 Refresh the sanitized Apps Hub preview, verify `/healthz` reports Postgres, and manually inspect the team history workflow and downstream round resolution.
- [x] 3.4 Record the preview verification and leave production unchanged pending explicit approval.

Preview verification (2026-09-22): preview `wok-preview-admin-race-audit-20260921.mhvmade.com` runs commit `2f3cb6e`, health reports `databaseBackend: postgres`, syntax checks and all project tests pass, and the team-period editor was inspected with seeded replacement history. Production remains unchanged.
