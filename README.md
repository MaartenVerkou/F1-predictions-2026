# F1 Predictions 2026

Simple group-based prediction game for the 2026 F1 season.

## Local dev

```powershell
npm install
npm start
```

Visit `http://localhost:3000`.

## Docker

```powershell
docker build -t f1-predictions-2026 .
docker run --rm -p 3000:3000 -v ${PWD}/data:/app/data f1-predictions-2026
```

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

Enter season results at `/admin/actuals` after the season. The leaderboard at `/groups/:id/leaderboard` computes totals automatically from those actuals and the saved predictions.

## Environment variables

- `PORT` - server port (default `3000`)
- `DATA_DIR` - data directory (default `./data`)
- `DB_PATH` - sqlite db path (default `DATA_DIR/app.db`)
- `QUESTIONS_PATH` - question file path (default `DATA_DIR/questions.json`)
- `ROSTER_PATH` - roster file path (default `DATA_DIR/roster.json`)
- `RACES_PATH` - races file path (default `DATA_DIR/races.json`)
- `SESSION_SECRET` - session cookie secret
- `DEV_AUTO_LOGIN` - set to `1` to auto-login in development (ignored in production)
- `DEV_AUTO_LOGIN_EMAIL` - email for auto-login user (default `dev@example.com`)
- `DEV_AUTO_LOGIN_NAME` - name for auto-login user (default `Dev Admin`)
- `ADMIN_PASSWORD` - password required to access `/admin/*`
