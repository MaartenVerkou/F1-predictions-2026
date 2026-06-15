## Context

The repo already contains production-facing code for automatic actuals syncing, per-round actual snapshots, and admin review state, but that behavior has no OpenSpec trail. The deployed server also already runs this app from `/opt/F1-predictions-2026` with Docker Compose, host-managed `.env`, SQLite state mounted from `/var/lib/wheelofknowledge/state`, and host-level Restic backups to Cloudflare R2. The missing piece is a checked-in deployment workflow that updates code in that existing shape without taking over secrets or backup jobs.

## Goals / Non-Goals

**Goals:**
- Capture the current actual snapshot and review behavior as an explicit product contract.
- Keep automatic actuals syncing shared between the startup scheduler, the admin-triggered sync, and manual review flows.
- Add a GitHub Actions deploy workflow that preserves the current server contract and verifies health after rollout.
- Document the GitHub secrets and server assumptions required for safe deployment.

**Non-Goals:**
- Replace SQLite with an external database.
- Move actuals writes into GitHub Actions or another off-box job runner.
- Replace the existing host-level Restic-to-R2 backup automation.
- Convert deployment to a container registry flow in this change.

## Decisions

### 1. Actual snapshots remain append-only when synced values change

The existing helper now reuses the latest snapshot only when the computed values are unchanged and otherwise inserts a new latest snapshot marked `pending`. This keeps historical round state auditable, avoids in-place mutation of already reviewed snapshots, and matches the admin review backlog model.

Alternative considered:
- Update the existing latest snapshot in place. Rejected because it erases whether a round changed after review and was the source of the foreign-key-heavy update path that failed against the live database.

### 2. Automatic sync continues to run through the shared backfill script

`src/actuals-auto-update.js` shells out to `scripts/backfill-actuals-2026.js`, and the admin button uses the same script path. Keeping one script as the source of truth means the scheduler, manual admin sync, and ad hoc verification all compute the same round snapshots and cancellation handling.

Alternative considered:
- Split scheduler logic into a separate in-process implementation. Rejected because it would duplicate result-fetching and round-serialization logic that already exists in the backfill script.

### 3. GitHub deploy uses SSH plus an application bundle, then rebuilds on the server

The deploy workflow will ship a narrow runtime bundle to the existing server path and run `docker compose up -d --build --no-deps app` there. This preserves the current server topology, avoids forcing a registry migration, and keeps `.env`, mounted SQLite state, and host backup jobs under server ownership.

Alternatives considered:
- Build and push an image to a registry, then pull on the server. Rejected for now because the current server flow is source-based and there is no established registry or image promotion contract in this repo.
- Deploy with `git pull` on the server. Rejected because the live server repo had local operational drift earlier, and a bundle-based publish is safer than assuming the server worktree is pristine.

### 4. Deployment health is enforced with the existing `/healthz` endpoint

The rollout check will wait for the app to answer `GET /healthz` locally on the server after the container rebuild. On failure, the workflow will print recent app logs and fail the job. This reuses the same readiness signal already covered by tests, Docker healthcheck, and CI smoke.

Alternative considered:
- Treat `docker compose up` success as sufficient. Rejected because the last production issue was a post-start runtime failure, so deploy needs an application-level check.

## Risks / Trade-offs

- [Remote Docker build is slower than registry promotion] → Keep the current server-compatible approach now; revisit registry builds only when the operational contract is ready.
- [Deploying from GitHub Actions depends on SSH secret hygiene] → Require a dedicated deploy key and strict `known_hosts` verification in GitHub secrets.
- [Automatic sync still depends on external racing data quality] → Keep latest sync pending review and expose the backlog in admin UI so corrections remain explicit.
- [Bundle-based deploy can drift from an interactive server worktree] → Package the runtime files explicitly and document the server path/compose contract instead of relying on ad hoc manual edits.

## Migration Plan

1. Add the OpenSpec change artifacts so the repo records the current actual-sync behavior and the intended deploy contract.
2. Add the GitHub Actions deploy workflow and a small server-side deploy helper script that accepts compose-file configuration via environment.
3. Document required GitHub secrets: SSH private key, known hosts, host, user, port, path, and optional compose-file override.
4. Verify locally with lint, tests, build, and Playwright.
5. Verify the server rollout path by redeploying to the existing host and confirming `GET /healthz` plus automatic actuals sync success.

Rollback:
- Re-run the deploy workflow for the previous known-good commit, or manually restore the repo runtime backup on the server if code rollback is needed.
- Application state rollback remains the responsibility of the existing host-level SQLite/Restic backup workflow.

## Open Questions

- Should production deploy stay on `push` to `main`, or should the GitHub `production` environment require approval before the job can start?
- Should a later change standardize whether the server always uses `docker-compose.server.yml`, or should that remain an environment-level override?
