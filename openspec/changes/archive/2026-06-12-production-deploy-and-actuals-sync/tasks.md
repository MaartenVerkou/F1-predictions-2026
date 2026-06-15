## 1. Actual Sync Review Contract

- [x] 1.1 Confirm the current actual snapshot, pending-review, and cancelled-race behavior matches the new OpenSpec requirements and tests.
- [x] 1.2 Align any remaining actuals sync or admin review code paths with the documented snapshot rules.

## 2. Production Deployment Automation

- [x] 2.1 Add a GitHub Actions workflow that deploys the runtime bundle to the existing Docker Compose server over SSH.
- [x] 2.2 Add or update supporting deployment helpers and documentation for server path, compose-file selection, and required GitHub secrets.

## 3. Verification

- [x] 3.1 Run local verification for lint, tests, build, actuals sync, and Playwright coverage.
- [x] 3.2 Verify the deployment path against the live server rollout steps and confirm post-deploy health.
