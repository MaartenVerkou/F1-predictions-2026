# ADR 0001: Queued Codex Resolution Runner

Date: 2026-06-27

## Status

Proposed

## Context

Admins want to turn recorded ideas and reported problems into Codex-assisted fixes from the web UI. The same server will host multiple apps, each with its own Codex environment. Letting the website run shell commands directly would give a request handler too much power, make long-running jobs fragile, and blur the boundary between admin intent, Codex execution, preview validation, and production deployment.

## Decision

Use the web application as a control plane and a separate queued runner as the execution plane.

The web app records Resolution Runs, validates admin actions, exposes status, and stores audit events. The runner executes queued work outside the HTTP request lifecycle, as the app-scoped Codex user, in app-scoped worktrees. The runner receives structured prompt input generated from stored run data rather than arbitrary shell commands from the browser. Production deployment remains Git-backed and admin-approved.

## Consequences

- Admins get a clear UI for request, review, iteration, preview, and deploy decisions.
- Codex execution can have OS-level permissions, timeouts, log redaction, and cleanup independent from the web app.
- The pattern can be repeated per app with app-specific adapters.
- Implementation is more complex than a single button because it requires durable run state, a worker process, preview lifecycle, and deployment gates.
- Direct production deployment must remain a separate approval step because a successful runner output is still only a candidate.

## Alternatives Considered

- Run Codex directly from the web request: simpler UI wiring, but too much privilege and poor failure behavior for long-running work.
- Expose arbitrary prompt or shell execution to admins: flexible, but unsafe and difficult to audit or standardize across apps.
- Use only local desktop Codex for all fixes: safe enough for manual work, but does not create the desired server-side admin workflow or reusable app pattern.
