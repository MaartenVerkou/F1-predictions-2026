## 1. Single-round source pipeline

- [x] 1.1 Add a validated selected-round argument to the canonical backfill runner and pass it through the existing auto-update wrapper.
- [x] 1.2 Ensure selected-round runs fetch through the existing OpenF1 pipeline but persist only the requested round, preserve destructor evidence, append a provider revision, and leave its derived actual snapshot pending.
- [x] 1.3 Add unit coverage for selected-round filtering, revision preservation, and failed-run no-op behavior.

## 2. Protected admin action

- [x] 2.1 Add an admin-only `POST /admin/race-data/refresh` route with CSRF/confirmation validation, selected-context redirect, sanitized audit logging, and concise error handling.
- [x] 2.2 Add route tests proving the target round is passed to the runner and that missing confirmation/invalid targets do not mutate data.

## 3. Race Data review UI

- [x] 3.1 Render a compact `Refresh source` action beside `Edit data` for a selected persisted round, with an explicit confirmation and preserved season/round/view/focus context.
- [x] 3.2 Hide or disable refresh while full-table edit mode is active and keep the existing Save/Discard behavior unchanged.
- [x] 3.3 Add focused template/style coverage for the refresh control, pending-review state, and responsive toolbar alignment.

## 4. Verification and handoff

- [x] 4.1 Run targeted unit tests, lint, and build; verify no existing correction/review behavior regresses.
- [x] 4.2 Run Playwright against preview for refresh success/failure and confirm that prior revisions and published scoring remain intact until review.
- [x] 4.3 Run strict OpenSpec validation and record the preview URL, commit, and any remaining provider/network risk.
