## 1. Data Model and Contracts

- [ ] 1.1 Add resolution-run tables for runs, events, validation checks, previews, and deploy candidates.
- [ ] 1.2 Add repository functions for creating runs, listing runs by idea/status, appending events, and updating lifecycle state.
- [ ] 1.3 Add structured run input validation for objective, type, expected scope, notes, and follow-up iterations.
- [ ] 1.4 Add tests for run creation, authorization-relevant persistence rules, and status transitions.

## 2. Admin UI Tracer Bullet

- [ ] 2.1 Add a resolution-run list page and admin navigation entry using existing admin layout classes.
- [ ] 2.2 Add "Try with Codex" actions on idea rows that create an `investigate` run.
- [ ] 2.3 Add a run detail page showing linked idea, objective, timeline, runner state, validation state, and next actions.
- [ ] 2.4 Add CSRF-protected admin mutations for create, cancel, reject, and iterate actions.
- [ ] 2.5 Add integration tests for non-admin denial and CSRF-protected admin run mutations.
- [ ] 2.6 Add a one-step "save and try with Codex" path for new ideas and a post-submit redirect to the run detail page.
- [ ] 2.7 Add admin-facing phase labels, last activity time, and recommended next-step copy to run list and detail pages.

## 3. Runner Abstraction

- [ ] 3.1 Implement a runner adapter interface with a fake runner for local tests and UI development.
- [ ] 3.2 Add prompt rendering from structured run data and repo workflow instructions.
- [ ] 3.3 Add a runner loop command that claims queued runs, records heartbeats, writes sanitized logs, and handles timeout/failure.
- [ ] 3.4 Add tests for runner claiming, event logging, failure handling, and iteration continuation.
- [ ] 3.5 Record current runner phase and last heartbeat so the UI can distinguish active work from a stuck run.

## 4. F1 Server Runner

- [ ] 4.1 Add F1 runner configuration for `/srv/codex/f1` paths, branch naming, and worktree naming.
- [ ] 4.2 Add server helper for non-interactive workspace-write Codex runs in app-scoped worktrees.
- [ ] 4.3 Ensure runner commands execute as `f1-codex` and cannot target paths outside `/srv/codex/f1/worktrees`.
- [ ] 4.4 Add operational docs for installing, starting, stopping, and inspecting the F1 runner service.
- [ ] 4.5 Verify the runner cannot read production `.env` or central infrastructure secret files.

## 5. Validation and Preview

- [ ] 5.1 Record validation checks for lint, typecheck, build, unit tests, Docker build, health check, and selected Playwright smoke tests.
- [ ] 5.2 Add preview metadata and admin-only preview status to run detail pages.
- [ ] 5.3 Implement preview database snapshot or clone creation that never writes to the live production database.
- [ ] 5.4 Add preview lifecycle cleanup for expired previews, worktrees, and logs.
- [ ] 5.5 Add Playwright coverage for the admin run review and preview link flow.
- [ ] 5.6 Add a visible "Ready to test" state only after required validation passes and an admin-only preview URL is available.
- [ ] 5.7 Configure central Caddy/DNS preview routing for server-hosted HTTPS previews such as `f1-run-<id>.preview.mhvmade.com`.
- [ ] 5.8 Add retention cleanup for 7-day previews, 14-day inactive worktrees, and 30-day admin-visible logs.

## 6. Deploy Candidate Flow

- [ ] 6.1 Add deploy-candidate state and admin actions gated by passing validation checks.
- [ ] 6.2 Keep direct immediate production deploy out of v1 and ensure no immediate deploy action is exposed.
- [ ] 6.3 Add scheduled overnight deploy queue with exact ref recording and stale-validation checks before execution.
- [ ] 6.4 Add admin UI for deploy history, blocked deploy reasons, and revalidation prompts.
- [ ] 6.5 Add tests for deploy gating, stale candidate blocking, and exact ref recording.

## 7. Production Readiness

- [ ] 7.1 Add rate limits and per-admin audit metadata for resolution-run actions.
- [ ] 7.2 Add log redaction for secrets and sensitive environment values.
- [ ] 7.3 Add observability events for queued, running, failed, needs-review, validated, deployed, and rejected runs.
- [ ] 7.4 Update server and admin documentation with the full operator workflow.
- [ ] 7.5 Run full verification: unit/integration tests, lint/typecheck/build, Playwright admin flow, OpenSpec validation, deploy smoke checks.
