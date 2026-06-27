## Why

Admins can already capture future ideas, but there is no controlled path to turn an idea or reported problem into a tested code change. Running Codex directly from the website would be risky unless the workflow separates request intake, isolated execution, preview validation, and human deployment approval.

## What Changes

- Add an admin-only Codex resolution workflow that starts from an existing idea or a new reported problem.
- Provide a clear "Try with Codex" entry point from the ideas inbox and a one-step "capture and try" path for newly reported admin ideas.
- Allow admins to request an AI attempt with a constrained objective, expected impact, and run mode instead of exposing arbitrary shell access.
- Track each AI attempt as an auditable resolution run with current phase, last activity, logs, branch/worktree metadata, test results, preview URL, and final disposition.
- Show admin-facing states that make the next step obvious, including queued, running, needs admin input, failed, ready to test, ready to approve, scheduled, and deployed.
- Introduce a server-side runner boundary that invokes the existing F1 Codex environment outside the web request process.
- Support iterative follow-up prompts on an existing run without losing the audit trail.
- Require a passing validation checklist and preview link before a run is marked ready to test or can become a deploy candidate.
- Let admins either deploy an approved candidate immediately or schedule it for an overnight deploy queue.
- Treat this F1 implementation as the reference pattern for future apps on the same MHV server.

## Capabilities

### New Capabilities

- `admin-codex-resolution-workflow`: Admin-facing workflow for requesting, reviewing, iterating, validating, previewing, and approving Codex-generated fixes.

### Modified Capabilities

- `admin-ideas-inbox`: Ideas can be linked to one or more Codex resolution runs and show the current automation outcome.
- `admin-interface`: Admin navigation and pages expose the resolution workflow without breaking existing admin layout and form-protection behavior.
- `production-deployment`: Deployment gains an admin-approved candidate queue with immediate and scheduled deployment modes.
- `server-codex-environments`: The F1 Codex environment gains a web-triggered runner boundary while keeping app-scoped isolation and no direct production edit rights.

## Impact

- Affected app areas: admin ideas page, new admin resolution-run pages, admin navigation, persistence schema, background job orchestration, deploy status display.
- Affected server areas: `/srv/codex/f1`, the `f1-codex` helper commands, a future F1 Codex runner service, preview app lifecycle, and deployment hooks.
- Security impact: requires strict admin-only authorization, CSRF protection, command allowlisting, audit logs, rate limits, and no arbitrary public prompt execution.
- Testing impact: needs integration tests for admin run lifecycle, authorization tests, runner contract tests, and Playwright coverage for the critical admin UI flow.
