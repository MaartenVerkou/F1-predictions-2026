const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { ensureSeasonInputsSchema } = require("../src/season-inputs");
const { verifySeasonInputs } = require("../scripts/verify-season-inputs");

function createDatabase() {
  const db = new Database(":memory:");
  db.dialect = "sqlite";
  ensureSeasonInputsSchema(db);
  return db;
}

test("season preflight rejects a missing canonical season", (t) => {
  const db = createDatabase();
  t.after(() => db.close());

  assert.throws(
    () => verifySeasonInputs(db, { season: 2026 }),
    /catalog is missing for 2026/
  );
});

test("season preflight rejects an incomplete canonical catalog", (t) => {
  const db = createDatabase();
  t.after(() => db.close());
  db.prepare("INSERT INTO seasons (id, year, label, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(1, 2026, "2026", "active", "now", "now");

  assert.throws(
    () => verifySeasonInputs(db, { season: 2026 }),
    /catalog is incomplete for 2026/
  );
});

test("season preflight returns the canonical catalog summary", (t) => {
  const db = createDatabase();
  t.after(() => db.close());
  db.exec(`
    INSERT INTO seasons (id, year, label, status, created_at, updated_at)
      VALUES (1, 2026, '2026', 'active', 'now', 'now');
    INSERT INTO season_drivers (season_id, driver_id, created_at, updated_at)
      VALUES (1, 10, 'now', 'now');
    INSERT INTO season_teams (season_id, team_id, created_at, updated_at)
      VALUES (1, 20, 'now', 'now');
    INSERT INTO races (season_id, round_number, slug, display_name, calendar_state, created_at, updated_at)
      VALUES (1, 1, 'round-1', 'Round 1', 'completed', 'now', 'now');
  `);

  assert.deepEqual(verifySeasonInputs(db, { season: 2026 }), {
    seasonId: 1,
    year: 2026,
    label: "2026",
    status: "active",
    drivers: 1,
    teams: 1,
    races: 1
  });
});
