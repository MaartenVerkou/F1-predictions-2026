# F1 Predictions 2026

Simple group-based prediction game for the 2026 F1 season.

## Local dev

```powershell
copy .env.example .env
npm install
npm start
```

Visit `http://localhost:3000`.

## Docker Compose (recommended)

This repo has a Compose project name configured: `name: f1predictions`.

Run from the repo root:

```powershell
copy .env.example .env
docker compose up -d --build
```

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
- Login/user/session data persists in Docker volume `f1predictions_f1_state` (`/app/state` in container).
- Question config stays in repo `./data` and is mounted read-only at `/app/config`.
- `docker compose down -v` removes the Docker volume (database + sessions).

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

Enter season results at `/admin/actuals` after the season. Leaderboard scoring is currently disabled until season results are finalized.

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
- `DATA_DIR` - data directory (default `./data`)
- `DB_PATH` - sqlite db path (default `DATA_DIR/app.db`)
- `QUESTIONS_PATH` - question file path (default `DATA_DIR/questions.json`)
- `ROSTER_PATH` - roster file path (default `DATA_DIR/roster.json`)
- `RACES_PATH` - races file path (default `DATA_DIR/races.json`)
- `SESSION_SECRET` - session cookie secret
- `ADMIN_EMAILS` - comma-separated admin whitelist emails (e.g. `admin@example.com,owner@example.com`)
- `SMTP_USER` - sender mailbox username/login (e.g. `no-reply@example.com`)
- `SMTP_PASS` - sender mailbox password
- `SMTP_HOST` - SMTP host (e.g. `mail.example.com`)
- `SMTP_PORT` - optional SMTP port (default `465`); SSL/TLS is chosen automatically (`465` secure, others STARTTLS/plain)
- `SMTP_CLIENT_NAME` - optional SMTP client/EHLO name; defaults to the domain part of `SMTP_USER`
- `APP_DOMAIN` - app domain/host (default `localhost`); used by built-in Caddy edge profile and for email verification/reset links. For localhost, the app uses `http://localhost:PORT`; otherwise it uses `https://APP_DOMAIN`.
- `DEV_AUTO_LOGIN` - set to `1` to auto-login a dev user on each request (disabled when `NODE_ENV=production`)
- `DEV_AUTO_LOGIN_EMAIL` - email used for dev auto-login (default `dev@example.com`)
- `DEV_AUTO_LOGIN_NAME` - display name used for dev auto-login (default `Dev Admin`)
- `PREDICTIONS_CLOSE_AT` - ISO datetime after which predictions are locked
- `LEADERBOARD_ENABLED` - set to `1` to enable leaderboard for non-admin users
- `PAYPAL_DONATION_URL` - optional full PayPal donation URL; when set, a donation button is shown on home page
- `PAYPAL_DONATION_LABEL` - optional button label for donation button (default `Donate`)

Note: for Docker, variables from `.env` must be referenced in `docker-compose.yml` (`environment:` or `env_file:`) to be available inside the app container.
