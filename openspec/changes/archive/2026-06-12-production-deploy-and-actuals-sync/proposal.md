## Why

The repo has production-facing changes for round-by-round actual snapshot syncing and admin review, but there is no OpenSpec record for that behavior and no checked-in GitHub deploy workflow for the server that is already running this app. That leaves the live system ahead of the spec trail and makes repeatable deployment depend on manual shell steps.

## What Changes

- Formalize the current actual sync behavior as a supported product capability, including per-round actual snapshots, automatic season sync, pending-review state, and admin review of the latest synced round.
- Formalize the handling of cancelled 2026 races and late backfills so season sync can keep historical round state consistent without admin re-entry.
- Add a GitHub Actions deployment workflow that ships the existing Docker Compose application layout to the current server shape over SSH, rebuilds the app container there, and verifies health after deploy.
- Document the deployment contract, required GitHub secrets, and the server-side assumptions that must stay intact, including host-managed SQLite state and host-level Cloudflare R2 backups.

## Capabilities

### New Capabilities
- `actuals-sync-review`: Automatic and manual actual updates produce per-round snapshots with review tracking so the leaderboard can reflect each completed round while admins can confirm or correct the latest sync.
- `production-deployment`: GitHub Actions can deploy the current application safely to the existing Docker Compose server and verify that the app comes back healthy.

### Modified Capabilities
- None.

## Impact

- Affected code: `server.js`, `src/actuals-auto-update.js`, `src/actuals-snapshots.js`, `src/routes/admin.js`, `scripts/backfill-actuals-2026.js`, `views/admin_actuals.ejs`
- Affected delivery/config: `.github/workflows/*`, Docker Compose files, `.dockerignore`, `.gitignore`, `.env.example`
- Affected docs: `README.md`, `docs/observability.md`, `docs/production-readiness.md`
- Affected operations: GitHub repository secrets, SSH-based deploy access, server path `/opt/F1-predictions-2026`, host state at `/var/lib/wheelofknowledge/state`, and existing Restic-to-R2 backups
