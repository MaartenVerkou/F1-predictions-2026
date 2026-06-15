# Production Readiness

Use this checklist for small production apps. Keep it practical; not every item needs a new tool on day one.

## App

- Required environment variables are listed in .env.example.
- Secrets are stored in the deployment platform or GitHub secrets, not in the repo.
- The app has a health endpoint or equivalent smoke-check route.
- Critical user flows are covered by Playwright.
- Important behavior has unit/integration tests where useful.

## Observability

- Server errors are logged with enough context to debug.
- Frontend errors are captured by an error tracker when deployed.
- Logs avoid passwords, tokens, cookies, and personal data unless explicitly needed.
- Production has a clear LOG_LEVEL value.
- Important admin/user actions have an audit trail when the app handles money, permissions, accounts, or sensitive data.
- Automatic actuals sync has structured logs and an admin-visible review backlog.

## Security

- Dependabot is enabled.
- CodeQL is enabled when the stack supports it.
- No .env files or secrets are committed.
- Auth, roles, and access control are specified before implementation.
- External webhooks and API callbacks verify signatures where applicable.

## Release

- CI passes before merge.
- Docker builds if a Dockerfile exists.
- Production deploys use the checked-in GitHub Actions workflow and verify `/healthz` after rollout.
- Migrations are planned before deploy.
- Rollback path is known for risky changes.

## Current Baseline

- Runtime is pinned to Node 20 in Docker and GitHub Actions.
- `/healthz` is covered by Node tests, Playwright, Docker healthcheck, and CI smoke.
- Dependency audit currently passes at high severity and above.
- Server backups are handled by external Restic/R2 host automation, not repo-local scripts.
- Production can auto-sync completed race actuals in-process without moving SQLite writes into GitHub Actions.
- Production deployment can ship the runtime bundle over SSH without taking ownership of host-managed secrets or SQLite state.
