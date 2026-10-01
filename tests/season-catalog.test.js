const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");

const { ensureSeasonInputsSchema } = require("../src/season-inputs");
const { buildSeasonCatalog } = require("../src/season-catalog");

function createDb() {
  const db = new Database(":memory:");
  db.dialect = "sqlite";
  ensureSeasonInputsSchema(db);
  db.exec(
    "INSERT INTO seasons (id, year, label, status, created_at, updated_at) VALUES (1, 2026, '2026', 'active', 'now', 'now');" +
    "INSERT INTO drivers (id, slug, given_name, family_name, display_name, created_at, updated_at) VALUES (1, 'driver-one', 'Driver', 'One', 'Driver One', 'now', 'now'), (2, 'driver-two', 'Driver', 'Two', 'Driver Two', 'now', 'now');" +
    "INSERT INTO teams (id, slug, display_name, created_at, updated_at) VALUES (10, 'team-one', 'Team One', 'now', 'now');" +
    "INSERT INTO races (id, season_id, round_number, slug, display_name, calendar_state, created_at, updated_at) VALUES (100, 1, 1, 'round-1', 'Round 1', 'completed', 'now', 'now'), (101, 1, 2, 'round-2', 'Round 2', 'scheduled', 'now', 'now');" +
    "INSERT INTO season_drivers (season_id, driver_id, driver_number, created_at, updated_at) VALUES (1, 1, '1', 'now', 'now'), (1, 2, '2', 'now', 'now');" +
    "INSERT INTO season_teams (season_id, team_id, display_order, created_at, updated_at) VALUES (1, 10, 1, 'now', 'now');" +
    "INSERT INTO driver_team_assignments (id, season_id, driver_id, team_id, from_round, to_round, seat_number, source, created_at, updated_at) VALUES (1000, 1, 1, 10, 1, NULL, 1, 'seed', 'now', 'now');"
  );
  return db;
}

test("season catalog has a stable revision and reports ready canonical inputs", (t) => {
  const db = createDb();
  t.after(() => db.close());
  const first = buildSeasonCatalog(db, 2026);
  const second = buildSeasonCatalog(db, 2026);
  assert.equal(first.revision, second.revision);
  assert.equal(first.readiness.status, "ready");
  assert.deepEqual(first.readiness.blocking, []);
  assert.equal(first.canonical.driver[0].value, "driver:1");
});

test("semantic changes produce a new catalog revision", (t) => {
  const db = createDb();
  t.after(() => db.close());
  const before = buildSeasonCatalog(db, 2026).revision;
  db.prepare("UPDATE teams SET display_name = ? WHERE id = ?").run("Renamed Team", 10);
  const after = buildSeasonCatalog(db, 2026).revision;
  assert.notEqual(after, before);
});

test("readiness blocks calendar gaps and assignments outside the catalog", (t) => {
  const db = createDb();
  t.after(() => db.close());
  db.prepare("UPDATE races SET round_number = ?, slug = ?, display_name = ? WHERE season_id = ? AND round_number = ?")
    .run(3, "round-3", "Round 3", 1, 2);
  db.prepare("UPDATE driver_team_assignments SET from_round = ? WHERE id = ?").run(4, 1000);
  const catalog = buildSeasonCatalog(db, 2026);
  assert.equal(catalog.readiness.status, "blocked");
  assert.ok(catalog.readiness.blocking.includes("calendar_gaps"));
  assert.ok(catalog.readiness.blocking.includes("invalid_assignments"));
});
