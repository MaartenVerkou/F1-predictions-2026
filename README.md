# Wheel of Knowledge

Simple group-based prediction game for the 2026 F1 season.

## Local dev

```powershell
copy .env.example .env
npm ci
npm start
```

Visit `http://localhost:3000`.

Use Node 20 for parity with Docker and GitHub Actions. The current native dependencies also support Node 22, 23, and 24 for local work.

## Docker Compose (recommended)

This repo has a Compose project name configured: `name: f1predictions`.

Run from the repo root:

```powershell
copy .env.example .env
docker compose up -d --build
```

In `NODE_ENV=development`, the Compose app service now bind-mounts the live source files and runs `npm run start:dev` with Node watch mode. That means:

- edits in `server.js` and `src/` restart the server automatically
- edits in `views/`, `public/`, and `locales/` are visible on refresh without rebuilding

If containers are already running, rebuild once after pulling these changes:

```powershell
docker compose up -d --build
docker compose logs -f app
```

When you save a file, the app container should restart automatically in development mode.

Enable built-in Caddy edge proxy (profile `edge`):

```powershell
docker compose --profile edge up -d --build
```

Useful commands:

```powershell
docker compose ps
docker compose logs -f app
docker compose logs -f caddy
docker compose down
docker compose down -v
```

## Production-parity local test

Use this before deploy when a UI change depends on real production-mode behavior, sessions, cookies, Docker packaging, or the SQLite state volume.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-production-parity.ps1
```

This starts the app through Docker with `NODE_ENV=production`, waits for `/healthz`, and prints the local app URL. It does not start Caddy or the Cloudflare tunnel by default. To include the built-in Caddy edge profile:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-production-parity.ps1 -WithEdge
```

Stop the local production-parity stack when finished:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/stop-production-parity.ps1
```

Volumes are preserved by default. Only use `-RemoveVolumes` when the local database/session state is disposable.

On server behind an already running shared Caddy, run with server override:

```powershell
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --build
```

Or run built-in Caddy in this repo (single-host edge):

```powershell
docker network create proxy
docker compose -f docker-compose.yml -f docker-compose.server.yml --profile edge up -d --build
```

Notes:

- App URL: `http://localhost:3000`
- Live reload behavior only applies when `NODE_ENV=development`
- Login/user/session data persists at `/app/state` in container.
- By default this uses Docker volume `f1predictions_f1_state`; set `STATE_DIR` in `.env` to use a host path instead (for example a Hetzner volume mount).
- Question config stays in repo `./data` and is mounted read-only at `/app/config`.
- `docker compose down -v` removes the Docker volume (database + sessions).

## Server backups

The deployed server uses an external Restic backup workflow for Cloudflare R2. It is intentionally not stored in this repo because it depends on host secrets.

Current server shape:

- State directory: `/var/lib/wheelofknowledge/state`
- Databases backed up: `app.db` and `sessions.db`
- Cron: `/etc/cron.d/wok-backup`
- Backup command: `/usr/local/sbin/wok-backup`
- Prune command: `/usr/local/sbin/wok-backup-prune`
- Secret/config file: `/etc/wok-backup.env`
- Log file: `/var/log/wok-backup.log`

The backup command performs SQLite online backups with integrity checks before sending snapshots to the Restic repository. Do not replace this with a repo-local backup script unless the host-level R2 setup is being retired deliberately.

## GitHub deploy workflow

The repo now includes `.github/workflows/deploy.yml`. A merge or push to `main` runs CI first; deploy starts automatically only after that CI workflow succeeds. Manual `workflow_dispatch` deploys are also supported.

The workflow keeps the current server contract:

- uploads a runtime bundle to the server over SSH
- refreshes only repo-managed runtime paths under `/opt/F1-predictions-2026` by default, including JSON config in `data/`
- runs `bash scripts/deploy-app.sh`
- rebuilds only the Docker Compose `app` service
- waits for `GET /healthz` and a rendered `GET /login` before marking the deploy successful
- does not overwrite host-managed `.env`, SQLite state, `/var/lib/wheelofknowledge/state`, or the external Restic/R2 backup setup

Required GitHub secrets:

- `DEPLOY_SSH_KEY`
- `DEPLOY_KNOWN_HOSTS`

Required GitHub repository or environment variables/secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`

Optional GitHub repository or environment variables/secrets:

- `DEPLOY_PORT` (default `22`)
- `DEPLOY_PATH` (default `/opt/F1-predictions-2026`)
- `DEPLOY_COMPOSE_FILES` (default `docker-compose.yml`; set `docker-compose.yml:docker-compose.server.yml` when the server should use the override)
- `DEPLOY_HEALTH_URL` (default `http://127.0.0.1:3000/healthz`)
- `DEPLOY_RENDER_PROBE_URL` (default `http://127.0.0.1:3000/login`; set empty to disable)

To generate `DEPLOY_KNOWN_HOSTS` safely:

```bash
ssh-keyscan -H your-server.example.com
```

For guarded production rollouts, configure the GitHub `production` environment with required reviewers.

If you previously used `./data:/app/data` and want to keep that old database, run this once before first start with the new setup (Linux/macOS shell):

```bash
docker compose down
docker volume create f1predictions_f1_state
docker run --rm -v f1predictions_f1_state:/state -v "$(pwd)/data:/legacy" alpine sh -c "cp -f /legacy/app.db /state/app.db 2>/dev/null || true; cp -f /legacy/sessions.db /state/sessions.db 2>/dev/null || true"
docker compose up -d --build
```

## Cloudflare tunnel (TryCloudflare)

This repo includes an optional `cloudflared` service in `docker-compose.yml` (profile: `tunnel`) that creates a random TryCloudflare URL (no token required).

Start app + tunnel only when needed:

```powershell
docker compose --profile tunnel up -d --build
docker compose logs -f tunnel
```

The tunnel URL changes on restarts. To avoid rotating links, use a named tunnel with a token.

## Caddy Workflow

Default Caddy config file for this repo is in project root:

- `./Caddyfile`

Single app / single repo:

1. Run `docker compose --profile edge up -d --build`.
2. Caddy uses `./Caddyfile` and auto-manages TLS certs.

Multiple apps on one server:

1. Run Caddy only once (from one repo/stack) with `--profile edge`.
2. Start other apps without `--profile edge`.
3. Add additional site blocks to the running Caddy instance config.
4. Reload Caddy after edits:

```bash
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Important: never run two Caddy instances binding host ports `80/443` on the same server.

## Questions file

Replace `data/questions.json` with your question list. Supported shape:

```json
{
  "questions": [
    { "id": "unique_id", "prompt": "Question text", "type": "text", "helper": "optional" },
    { "id": "longer_answer", "prompt": "Question text", "type": "textarea" },
    { "id": "yes_no", "prompt": "Yes/No question", "type": "boolean" },
    { "id": "driver_pick", "prompt": "Pick one driver", "type": "single_choice", "options_source": "drivers" },
    { "id": "top_3", "prompt": "Pick top 3", "type": "ranking", "count": 3, "options_source": "teams" },
    { "id": "podium_finishers", "prompt": "Select all podium finishers", "type": "multi_select", "options_source": "drivers" },
    { "id": "select_three_races", "prompt": "Select 3 races", "type": "multi_select_limited", "count": 3, "options_source": "races" },
    { "id": "battle", "prompt": "Teammate battle", "type": "teammate_battle", "options": ["Driver A", "Driver B"] },
    { "id": "ban", "prompt": "Race ban?", "type": "boolean_with_optional_driver", "options_source": "drivers" },
    { "id": "lowest_win", "prompt": "Lowest grid win + driver", "type": "numeric_with_driver", "options_source": "drivers" }
  ]
}
```

## Roster file

Driver and team dropdowns are loaded from `data/roster.json`:

```json
{
  "drivers": ["Driver One", "Driver Two"],
  "teams": ["Team One", "Team Two"]
}
```

## Races file

Race options are loaded from `data/races.json`:

```json
{
  "races": ["Australian Grand Prix", "Chinese Grand Prix"]
}
```

## Scoring / actuals

`/admin/actuals` now supports two workflows:

- `Preview Autofill In Form` fills the current admin form draft only.
- `Run Season Sync Now` backfills every completed round snapshot, updates live actuals from the latest completed round, and leaves the latest synced round pending admin review.

The app can also run the same season sync automatically in production. Each synced round snapshot stores a review state:

- `Pending review`: auto-filled or changed since the last admin confirmation.
- `Reviewed`: confirmed manually by an admin.

The leaderboard uses live actuals immediately, but the UI shows when the current round is still pending review.

Cancelled races that stay on the season calendar but never start are handled as zero-result rounds for the race-derived actuals that depend on official classification data, so later rounds can still backfill cleanly.

Manual commands:

```powershell
npm run actuals:auto-update
npm run actuals:auto-apply
```

## Last season references per question

The app can show a clickable "last season" source link and short result text under each question (on both Questions and Responses pages).

Generate/update the references file:

```powershell
npm run build:last-season-results
```

Optional custom season:

```powershell
node scripts/build-last-season-results.js 2025
```

The generated file is `data/last-season-results.json` by default (or `LAST_SEASON_RESULTS_PATH` if set in `.env`).

## Points balance simulation

You can run a local Monte Carlo style balance check with synthetic players that use "global F1 knowledge" (strong/weak teams) plus noise.

```powershell
npm run analyze:balance -- --players 1000 --seasons 200 --seed 42 --top 12
```

Optional JSON export:

```powershell
npm run analyze:balance -- --players 1000 --seasons 200 --json balance-report.json
```

## Auth behavior

- Signup requires account verification before login.
- Forgot password flow is available at `/forgot-password`.
- In development, `DEV_AUTO_LOGIN=1` can auto-login a dev user.
- In development with auto-login enabled, logout skips auto-login once, then auto-login resumes on later visits.

## Code layout

- `server.js` keeps app bootstrap, middleware, data setup, and shared helpers.
- `src/routes/auth.js` contains auth-related routes.
- `src/routes/admin.js` contains admin routes.

## Environment variables

- `PORT` - server port (default `3000`)
- `STATE_DIR` - optional Docker host path mounted to `/app/state`; if unset, Compose uses Docker named volume `f1_state` (recommended for local dev)
- `DATA_DIR` - data directory (default `./data`)
- `DB_PATH` - sqlite db path (default `DATA_DIR/app.db`)
- `QUESTIONS_PATH` - question file path (default `DATA_DIR/questions.json`)
- `ROSTER_PATH` - roster file path (default `DATA_DIR/roster.json`)
- `RACES_PATH` - races file path (default `DATA_DIR/races.json`)
- `SESSION_SECRET` - session cookie secret
- `ADMIN_EMAILS` - comma-separated admin whitelist emails (e.g. `admin@example.com,owner@example.com`)
- `SMTP_USER` - sender mailbox username/login (e.g. `no-reply@example.com`)
- `CONTACT_EMAIL` - contact email shown on the About/Contact section (defaults to `CONTACT_EMAIL`, then `SMTP_FROM` mailbox, then `SMTP_USER`)
- `SMTP_PASS` - sender mailbox password
- `SMTP_HOST` - SMTP host (e.g. `mail.example.com`)
- `SMTP_PORT` - optional SMTP port (default `465`); SSL/TLS is chosen automatically (`465` secure, others STARTTLS/plain)
- `SMTP_CLIENT_NAME` - optional SMTP client/EHLO name; defaults to `APP_DOMAIN` host (then `SMTP_USER` domain as fallback)
- `APP_DOMAIN` - app domain/host (default `localhost`); used by built-in Caddy edge profile and for email verification/reset links. For localhost, the app uses `http://localhost:PORT`; otherwise it uses `https://APP_DOMAIN`.
- `LOG_LEVEL` - structured server log threshold: `debug`, `info`, `warn`, `error`, or `silent` (default `info`)
- `TRUST_PROXY_HOPS` - trusted reverse proxy hop count for secure cookies and forwarded HTTPS detection (default `1` outside development)
- `DEV_AUTO_LOGIN` - set to `1` to auto-login a dev user on each request (disabled when `NODE_ENV=production`)
- `DEV_AUTO_LOGIN_EMAIL` - email used for dev auto-login (default `dev@example.com`)
- `DEV_AUTO_LOGIN_NAME` - display name used for dev auto-login (default `Dev Admin`)
- `PREDICTIONS_CLOSE_AT` - ISO datetime after which predictions are locked
- `LEADERBOARD_ENABLED` - set to `1` to enable leaderboard for non-admin users
- `ACTUALS_AUTO_UPDATE_ENABLED` - set to `1` to run automatic completed-round actuals sync in the app process (defaults to `1` in production and `0` in development/test)
- `ACTUALS_AUTO_UPDATE_INTERVAL_MINUTES` - background sync interval in minutes (default `180`)
- `ACTUALS_AUTO_UPDATE_ON_START` - set to `1` to run one sync shortly after app boot (default `1`)
- `ACTUALS_AUTO_UPDATE_START_DELAY_MS` - delay before the startup sync runs (default `30000`)
- `PAYPAL_DONATION_URL` - optional full PayPal donation URL; when set, a donation button is shown on home page
- `PAYPAL_DONATION_LABEL` - optional button label for donation button (default `Donate`)

Note: for Docker, variables from `.env` must be referenced in `docker-compose.yml` (`environment:` or `env_file:`) to be available inside the app container.
