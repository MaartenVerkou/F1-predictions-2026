const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const {
  ensureSeasonInputsSchema,
  removeSeasonMembership
} = require("../src/season-inputs");
const { buildLineupProjection } = require("../src/season-lineup");
const { registerAdminRoutes } = require("../src/routes/admin");

function createDatabase() {
  const db = new Database(":memory:");
  db.dialect = "sqlite";
  ensureSeasonInputsSchema(db);
  return db;
}

test("season schema removes legacy activity columns and unreferenced inactive members", () => {
  const db = createDatabase();
  db.exec(`
    ALTER TABLE drivers ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE teams ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE season_drivers ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE season_teams ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
    INSERT INTO seasons (id, year, label, status, created_at, updated_at) VALUES (1, 2026, '2026', 'active', 'now', 'now');
    INSERT INTO drivers (id, slug, given_name, family_name, display_name, created_at, updated_at) VALUES
      (1, 'kept', 'Kept', 'Driver', 'Kept Driver', 'now', 'now'),
      (2, 'removed', 'Removed', 'Driver', 'Removed Driver', 'now', 'now');
    INSERT INTO teams (id, slug, display_name, created_at, updated_at) VALUES
      (1, 'kept-team', 'Kept Team', 'now', 'now'),
      (2, 'removed-team', 'Removed Team', 'now', 'now');
    UPDATE season_drivers SET active = 0;
    UPDATE season_teams SET active = 0;
    INSERT INTO season_drivers (season_id, driver_id, created_at, updated_at) VALUES (1, 1, 'now', 'now'), (1, 2, 'now', 'now');
    INSERT INTO season_teams (season_id, team_id, created_at, updated_at) VALUES (1, 1, 'now', 'now'), (1, 2, 'now', 'now');
    UPDATE season_drivers SET active = 0 WHERE driver_id = 2;
    UPDATE season_teams SET active = 0 WHERE team_id = 2;
    INSERT INTO driver_team_assignments (id, season_id, driver_id, team_id, from_round, source, created_at, updated_at)
      VALUES (1, 1, 1, 1, 1, 'test', 'now', 'now');
  `);

  ensureSeasonInputsSchema(db);

  for (const table of ["drivers", "teams", "season_drivers", "season_teams"]) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
    assert.equal(columns.includes("active"), false, `${table}.active should be removed`);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM season_drivers WHERE driver_id = 1").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM season_drivers WHERE driver_id = 2").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM season_teams WHERE team_id = 1").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM season_teams WHERE team_id = 2").get().count, 0);
  db.close();
});

test("season membership removal preserves canonical identities and protects assignment history", () => {
  const db = createDatabase();
  db.exec(`
    INSERT INTO seasons (id, year, label, status, created_at, updated_at) VALUES (1, 2026, '2026', 'active', 'now', 'now');
    INSERT INTO drivers (id, slug, given_name, family_name, display_name, created_at, updated_at) VALUES
      (1, 'free', 'Free', 'Driver', 'Free Driver', 'now', 'now'),
      (2, 'referenced', 'Referenced', 'Driver', 'Referenced Driver', 'now', 'now');
    INSERT INTO teams (id, slug, display_name, created_at, updated_at) VALUES (1, 'team', 'Team', 'now', 'now');
    INSERT INTO season_drivers (season_id, driver_id, created_at, updated_at) VALUES (1, 1, 'now', 'now'), (1, 2, 'now', 'now');
    INSERT INTO season_teams (season_id, team_id, created_at, updated_at) VALUES (1, 1, 'now', 'now');
    INSERT INTO driver_team_assignments (id, season_id, driver_id, team_id, from_round, source, created_at, updated_at)
      VALUES (1, 1, 2, 1, 1, 'test', 'now', 'now');
  `);

  assert.deepEqual(removeSeasonMembership(db, { seasonId: 1, entityType: "driver", entityId: 1 }), {
    entityType: "driver",
    entityId: 1
  });
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM season_drivers WHERE driver_id = 1").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM drivers WHERE id = 1").get().count, 1);
  assert.throws(
    () => removeSeasonMembership(db, { seasonId: 1, entityType: "driver", entityId: 2 }),
    /assignment history/
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM season_drivers WHERE driver_id = 2").get().count, 1);
  db.close();
});

test("admin removal route deletes unreferenced membership and protects referenced membership", () => {
  const db = createDatabase();
  db.exec(`
    CREATE TABLE race_data_snapshots (id INTEGER PRIMARY KEY, season INTEGER NOT NULL);
    CREATE TABLE actual_snapshots (id INTEGER PRIMARY KEY, season INTEGER NOT NULL);
    INSERT INTO seasons (id, year, label, status, created_at, updated_at) VALUES (1, 2026, '2026', 'active', 'now', 'now');
    INSERT INTO drivers (id, slug, given_name, family_name, display_name, created_at, updated_at) VALUES
      (1, 'free', 'Free', 'Driver', 'Free Driver', 'now', 'now'),
      (2, 'referenced', 'Referenced', 'Driver', 'Referenced Driver', 'now', 'now');
    INSERT INTO teams (id, slug, display_name, created_at, updated_at) VALUES
      (1, 'team', 'Team', 'now', 'now');
    INSERT INTO races (id, season_id, round_number, slug, display_name, scheduled_date, calendar_state, created_at, updated_at)
      VALUES (1, 1, 1, 'round-1', 'Round 1', '2026-01-01', 'scheduled', 'now', 'now');
    INSERT INTO season_drivers (season_id, driver_id, created_at, updated_at) VALUES (1, 1, 'now', 'now'), (1, 2, 'now', 'now');
    INSERT INTO season_teams (season_id, team_id, created_at, updated_at) VALUES (1, 1, 'now', 'now');
    INSERT INTO driver_team_assignments (id, season_id, driver_id, team_id, from_round, source, created_at, updated_at)
      VALUES (1, 1, 2, 1, 1, 'test', 'now', 'now');
  `);

  const routes = {};
  const app = {
    get(pathname, ...handlers) { routes[`GET ${pathname}`] = handlers.at(-1); },
    post(pathname, ...handlers) { routes[`POST ${pathname}`] = handlers.at(-1); }
  };
  registerAdminRoutes(app, {
    db,
    requireAdmin: () => {},
    getCurrentUser: () => ({ id: 1 }),
    logEvent: () => {}
  });
  const remove = routes["POST /admin/inputs/remove"];
  assert.equal(typeof remove, "function");

  const invoke = (entityId) => {
    const response = {};
    remove(
      { body: { season: "2026", entity_type: "driver", entity_id: String(entityId) } },
      { redirect(location) { response.location = location; } }
    );
    return response.location;
  };

  const successLocation = invoke(1);
  assert.match(successLocation, /success=Driver\+removed\+from\+season\+inputs\./);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM season_drivers WHERE driver_id = 1").get().count, 0);

  const errorLocation = invoke(2);
  assert.match(errorLocation, /error=Driver\+has\+assignment\+history\+in\+this\+season\+and\+cannot\+be\+removed\./);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM season_drivers WHERE driver_id = 2").get().count, 1);

  const routeSource = fs.readFileSync(path.join(__dirname, "..", "src", "routes", "admin.js"), "utf8");
  assert.match(routeSource, /removeSeasonMembership\(db/);
  assert.doesNotMatch(routeSource, /season_active/);
  db.close();
});

test("grid participation follows assignment intervals instead of roster flags", () => {
  const teams = [{ id: 1, display_name: "Team", display_order: 1 }];
  const drivers = [{ id: 1, display_name: "Driver" }];
  const assignments = [
    { id: 1, team_id: 1, driver_id: 1, seat_number: 1, from_round: 1, to_round: 7 },
    { id: 2, team_id: 1, driver_id: 1, seat_number: 1, from_round: 10, to_round: null }
  ];

  assert.equal(buildLineupProjection({ teams, drivers, assignments, roundNumber: 8 })[0].seats[0].driverId, null);
  assert.equal(buildLineupProjection({ teams, drivers, assignments, roundNumber: 10 })[0].seats[0].driverId, 1);
});
