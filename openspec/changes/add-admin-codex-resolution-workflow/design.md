## Context

The app already has an admin-only ideas inbox with CSRF-protected mutations. The MHV server now has an app-scoped F1 Codex environment at `/srv/codex/f1` with its own Unix user, `CODEX_HOME`, repository mirror, and worktree directory. Production deployment still runs through GitHub Actions and the server-side Docker Compose rollout; Codex must not mutate `/srv/f1-predictions/current` directly.

The requested workflow turns an idea or reported problem into an admin-controlled automation loop:

1. Admin records or selects an idea.
2. Admin clicks a clear "Try with Codex" action or chooses "Save and try with Codex" while creating a new idea.
3. Admin lands on a run detail page that immediately shows queued/running progress and the next expected step.
4. The server creates an isolated branch/worktree and runs Codex there.
5. Tests and preview validation run against the candidate.
6. Admin sees an explicit ready-to-test state with a preview link, validation checklist, and changed-files summary.
7. Admin reviews the diff, logs, and preview.
8. Admin iterates, rejects, or approves the candidate for deployment.

## Goals / Non-Goals

**Goals:**

- Provide a professional admin UI for resolution runs linked to ideas.
- Keep all Codex execution auditable and app-scoped.
- Avoid arbitrary shell access from the website.
- Support multiple iterations on complex problems.
- Produce a preview environment with production-like data without granting Codex direct write access to production data.
- Allow approved candidates to enter an immediate or scheduled deploy path.
- Establish a reusable pattern for future MHV apps.

**Non-Goals:**

- Public user access to Codex or automation controls.
- Free-form browser-to-shell execution.
- Codex editing the live production checkout.
- Codex reading production `.env` files or central infrastructure secrets.
- Fully autonomous deploys without an admin approval step.
- Replacing the existing GitHub Actions deployment path.

## Decisions

This design is backed by [ADR 0001: Queued Codex Resolution Runner](../../../adr/0001-queued-codex-resolution-runner.md).

### 1. Web app is the control plane; a runner is the execution plane

The admin UI SHALL create resolution-run records and enqueue work. A separate F1 Codex runner service SHALL poll or receive jobs and execute them as `f1-codex` from `/srv/codex/f1/worktrees`.

Rationale: HTTP requests must stay short, observable, and revocable. Separating execution lets us apply OS permissions, rate limits, log redaction, timeouts, and restart behavior without expanding the web app's privileges.

Alternatives considered:

- Run Codex directly in the request handler: rejected because it couples admin requests to long-running shell execution and increases blast radius.
- Let admins paste arbitrary shell commands: rejected because it bypasses the app-scoped safety model.

### 2. Runs use structured objectives, not raw terminal prompts

The UI SHALL collect a title, linked idea, objective, run type, expected surface area, and optional admin notes. The backend SHALL render a controlled prompt template for the runner. The first version should expose run types such as `investigate`, `attempt_fix`, and `iterate`.

Rationale: Admins still provide intent, but the system can consistently instruct Codex to respect repo workflow, avoid secrets, run tests, and produce machine-readable summaries.

### 3. Every run owns a branch and worktree

Each resolution run SHALL create or reuse a branch such as `codex/f1/run-<id>-<slug>` and a worktree under `/srv/codex/f1/worktrees/run-<id>-<slug>`. Iterations on the same run continue on the same branch, while a new attempt can create a sibling run.

Rationale: This keeps changes reviewable, makes cleanup deterministic, and matches the existing per-app Codex environment pattern.

### 4. Preview uses a database snapshot, not direct production writes

Preview environments SHALL use a production-like database snapshot or clone created for that run. They SHALL NOT write to the live production database. A preview URL can therefore show realistic data without risking production state.

Rationale: The user wants the preview to feel like the same app and data. A snapshot provides that realism while keeping production safe.

Alternatives considered:

- Point preview at production Postgres: rejected because a candidate build could mutate real data.
- Use an empty preview database: safer but too weak for validating admin/user workflows.

### 5. Validation gates deploy eligibility

A run SHALL become a deploy candidate only after required validations are recorded: lint/typecheck/build/unit tests where applicable, relevant Playwright smoke tests, Docker build or preview health, and an admin-visible diff summary.

Rationale: Codex output should be treated as a candidate change, not as a trusted production action.

### 6. Deployment remains Git-backed

Approved deploy candidates SHALL deploy through the existing deployment mechanism. The candidate branch must be traceable and either merged/pushed through GitHub or deployed by a workflow that records the exact ref. Immediate deploy and overnight deploy are UI modes on top of the same deploy candidate state.

Rationale: Git remains the source of truth. This avoids mystery production state and keeps rollback/debugging practical.

### 7. The UI optimizes for admin decision-making

The admin ideas page should show a compact automation status for each idea, while a dedicated run detail page shows:

- objective and linked idea
- admin-facing phase label and recommended next step
- live/refreshing progress summary with last activity time
- current state timeline
- Codex summary
- changed files and diff link
- validation results
- preview URL
- CLI takeover command for trusted operators when the run needs manual work
- iteration form
- approve/reject/deploy actions when eligible

Rationale: Admins need to scan the inbox, then drill into a single operational workflow when a run needs attention.

The primary admin states should be intentionally plain:

- `Queued`: the request is accepted but not started.
- `Running`: Codex or validation is currently working.
- `Needs input`: Codex stopped because the task needs admin clarification or manual operator help.
- `Failed`: the run could not complete; show why and what can be retried.
- `Ready to test`: a preview is available and required validation has passed.
- `Ready to approve`: admin has tested the preview and can approve or reject deployment.
- `Scheduled`: the candidate is approved for a later deployment window.
- `Deployed`: the candidate reached production and health checks passed.

## Risks / Trade-offs

- **Runner gets stuck or loops too long** -> enforce per-run timeout, max iterations, status heartbeats, and cancel action.
- **Codex proposes unsafe changes** -> require validation and admin approval before deploy; keep production secrets unreadable.
- **Preview database snapshot contains sensitive user data** -> restrict preview URLs to admins, avoid logging row contents, and expire preview environments.
- **Branch diverges from main before scheduled deploy** -> rebase or recreate the candidate during deploy-window validation; block deploy on conflict.
- **Direct deploy makes rollback harder** -> record exact ref and keep existing GitHub Actions logs; prefer scheduled deploy for non-urgent changes.
- **Future apps repeat bespoke orchestration** -> keep the runner contract app-generic and app-specific details in per-app adapters.

## Migration Plan

1. Add schema tables for resolution runs, run events, validation checks, preview metadata, and deploy candidates.
2. Add admin UI surfaces behind existing admin access and CSRF protection.
3. Implement a local runner adapter interface with a fake/test runner first.
4. Add the F1 server runner using `/srv/codex/f1` and existing helper command patterns.
5. Add preview environment lifecycle and cleanup.
6. Add deploy-candidate actions that call the established deploy workflow.
7. Roll out with `investigate` mode enabled first, then enable `attempt_fix`, then enable deploy actions.

Rollback: disable the runner service and hide automation action buttons through configuration. Existing ideas remain usable because the ideas inbox is not replaced.

## Open Questions

- Should direct production deployment be enabled in v1, or should v1 only allow preview plus scheduled deploy?
- What retention period should apply to Codex logs, preview databases, and worktrees?
- Should future apps share one generic `mhv-codex-runner` binary with app adapters, or separate runner services per app?
