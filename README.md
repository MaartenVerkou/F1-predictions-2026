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

Useful commands:

```powershell
docker compose ps
docker compose logs -f app
docker compose down
docker compose down -v
```

Notes:

- App URL: `http://localhost:3000`
- Data persists in `./data` via bind mount (`./data:/app/data`).
- `down -v` does not remove `./data`; it only removes Compose-managed volumes.

## Cloudflare tunnel (TryCloudflare)

This repo includes an optional `cloudflared` service in `docker-compose.yml` (profile: `tunnel`) that creates a random TryCloudflare URL (no token required).

Start app + tunnel only when needed:

```powershell
docker compose --profile tunnel up -d --build
docker compose logs -f tunnel
```

The tunnel URL changes on restarts. To avoid rotating links, use a named tunnel with a token.

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
- `BASE_URL` - public base URL for verification links (e.g. `https://example.com`)
- `DEV_AUTO_LOGIN` - set to `1` to auto-login a dev user on each request (disabled when `NODE_ENV=production`)
- `DEV_AUTO_LOGIN_EMAIL` - email used for dev auto-login (default `dev@example.com`)
- `DEV_AUTO_LOGIN_NAME` - display name used for dev auto-login (default `Dev Admin`)
- `PREDICTIONS_CLOSE_AT` - ISO datetime after which predictions are locked
- `LEADERBOARD_ENABLED` - set to `1` to enable leaderboard for non-admin users

Note: for Docker, variables from `.env` must be referenced in `docker-compose.yml` (`environment:` or `env_file:`) to be available inside the app container.
