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
    { "id": "longer_answer", "prompt": "Question text", "type": "textarea" }
  ]
}
```

## Environment variables

- `PORT` - server port (default `3000`)
- `DATA_DIR` - data directory (default `./data`)
- `DB_PATH` - sqlite db path (default `DATA_DIR/app.db`)
- `QUESTIONS_PATH` - question file path (default `DATA_DIR/questions.json`)
- `SESSION_SECRET` - session cookie secret
