# F1 Predictions 2026

Simple group-based prediction game for the 2026 F1 season.

## Local dev

```powershell
copy .env.example .env
npm install
npm start
```

Visit `http://localhost:3000`.

## Docker

```powershell
docker build -t f1-predictions-2026 .
docker run --rm -p 3000:3000 -v ${PWD}/data:/app/data f1-predictions-2026
```

## Cloudflare tunnel (TryCloudflare)

This repo includes a `cloudflared` service in `docker-compose.yml` that creates a random TryCloudflare URL (no token required).

Start:

```powershell
docker compose up -d --build
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

## Environment variables

- `PORT` - server port (default `3000`)
- `DATA_DIR` - data directory (default `./data`)
- `DB_PATH` - sqlite db path (default `DATA_DIR/app.db`)
- `QUESTIONS_PATH` - question file path (default `DATA_DIR/questions.json`)
- `ROSTER_PATH` - roster file path (default `DATA_DIR/roster.json`)
- `RACES_PATH` - races file path (default `DATA_DIR/races.json`)
- `SESSION_SECRET` - session cookie secret
- `ADMIN_PASSWORD` - password required to access `/admin/*` (default `change-me`)
- `SMTP_USER` - sender mailbox username/login (e.g. `no-reply@example.com`)
- `SMTP_PASS` - sender mailbox password
- `SMTP_HOST` - SMTP host (e.g. `mail.example.com`)
- `SMTP_PORT` - optional SMTP port (default `465`)
- `SMTP_SECURE` - optional; `1`/`true` for SSL/TLS, `0`/`false` otherwise (default auto: true on port 465)
- `DEBUG_EMAIL_LINKS` - set to `1` in local/dev to show password reset links on the forgot-password page
- `BASE_URL` - public base URL for verification links (e.g. `https://example.com`)
- `AUTO_VERIFY` - set to `1` to auto-verify users (skip email verification)
