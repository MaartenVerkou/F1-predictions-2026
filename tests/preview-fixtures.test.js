const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { test } = require("node:test");
const { seedSanitizedPreview } = require("../scripts/seed-wok-preview");

test("sanitized preview seeds all seasons while keeping evidence scoped to 2026", () => {
  const db = new Database(":memory:");
  db.dialect = "sqlite";
  const previous = process.env.DATABASE_URL;
  const previousMode = process.env.WOK_PREVIEW_DATA_MODE;
  process.env.DATABASE_URL = "preview-fixture-test";
  process.env.WOK_PREVIEW_DATA_MODE = "sanitized";
  try {
    db.exec(`
      CREATE TABLE actuals (
        question_id TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
      );
      CREATE TABLE actual_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        season INTEGER NOT NULL,
        round_number INTEGER,
        round_name TEXT,
        label TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by_user_id INTEGER,
        review_status TEXT NOT NULL DEFAULT 'reviewed',
        reviewed_at TEXT,
        reviewed_by_user_id INTEGER,
        source_data_import_id INTEGER,
        source_data_snapshot_id INTEGER
      );
      CREATE TABLE actual_snapshot_values (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        snapshot_id INTEGER NOT NULL,
        question_id TEXT NOT NULL,
        value TEXT,
        UNIQUE(snapshot_id, question_id)
      );
    `);
    const result = seedSanitizedPreview(db, "2026-09-23T00:00:00.000Z");
    assert.deepEqual(result.seasons.map((season) => season.year), [2025, 2027]);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM seasons").get().count, 3);
    assert.deepEqual(
      db.prepare("SELECT year FROM seasons ORDER BY year").all().map((row) => row.year),
      [2025, 2026, 2027],
    );
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM races").get().count, 69);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM race_data_snapshots").get().count, 13);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM actual_snapshots").get().count, 13);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM driver_team_assignments").get().count, 76);
    const r8Payload = JSON.parse(
      db.prepare("SELECT payload_json FROM race_data_snapshots WHERE round_number = 8").get().payload_json
    );
    const r8Drivers = r8Payload.race.rows.map((row) => row.driver);
    assert.ok(r8Drivers.includes("Preview Replacement"));
    assert.equal(r8Drivers.includes("Kimi Antonelli"), false);
    const r8StandingNames = r8Payload.standings.drivers.map((row) => row.entity);
    assert.ok(r8StandingNames.includes("Preview Replacement"));
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    if (previousMode === undefined) delete process.env.WOK_PREVIEW_DATA_MODE;
    else process.env.WOK_PREVIEW_DATA_MODE = previousMode;
    db.close();
  }
});
