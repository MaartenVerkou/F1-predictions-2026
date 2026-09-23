const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const {
  assertSeasonMutationAllowed,
  listAdminSeasons,
  readSeasonMutationFlags,
  resolveAdminSeasonContext
} = require("../src/admin-season-context");
const { ensureSeasonInputsSchema } = require("../src/season-inputs");
const { registerAdminRoutes } = require("../src/routes/admin");

function buildDb() {
  const seasons = [
    { id: 1, year: 2025, label: "2025 archive", status: "archived" },
    { id: 2, year: 2026, label: "2026 active", status: "active" },
    { id: 3, year: 2027, label: "2027 preparation", status: "planned" }
  ];
  const rows = {
    season_drivers: [{ season_id: 2 }],
    season_teams: [{ season_id: 2 }],
    races: [{ season_id: 2 }, { season_id: 2 }],
    race_data_snapshots: [{ season: 2026 }],
    actual_snapshots: [{ season: 2026 }]
  };
  return {
    prepare(sql) {
      return {
        all() {
          return seasons.slice().sort((left, right) => right.year - left.year);
        },
        get(value) {
          const table = sql.match(/FROM (\w+)/i)?.[1];
          const column = sql.match(/WHERE (\w+) =/i)?.[1];
          return { count: (rows[table] || []).filter((row) => Number(row[column]) === Number(value)).length };
        }
      };
    }
  };
}

test("season catalog exposes lifecycle, counts, and capabilities", () => {
  const db = buildDb();
  const seasons = listAdminSeasons(db);
  assert.deepEqual(seasons.map((season) => season.year), [2027, 2026, 2025]);
  assert.equal(seasons.find((season) => season.year === 2026).syncable, true);
  assert.equal(seasons.find((season) => season.year === 2026).counts.evidenceSnapshots, 1);
  assert.equal(seasons.find((season) => season.year === 2025).editable, false);
  assert.equal(seasons.find((season) => season.year === 2027).editable, true);
});

test("requested season is selected without falling back when invalid", () => {
  const db = buildDb();
  const active = resolveAdminSeasonContext(db, { currentSeason: 2026 });
  assert.equal(active.selected.year, 2026);
  assert.equal(active.isValid, true);

  const archived = resolveAdminSeasonContext(db, { requestedSeason: "2025", currentSeason: 2026 });
  assert.equal(archived.selected.status, "archived");
  assert.equal(archived.editable, false);
  assert.equal(archived.syncable, false);

  const missing = resolveAdminSeasonContext(db, { requestedSeason: "2099", currentSeason: 2026 });
  assert.equal(missing.selected, null);
  assert.equal(missing.invalidRequestedSeason, true);
  assert.equal(missing.isValid, false);
});

test("lifecycle mutation guard distinguishes preparation, active, and historical edits", () => {
  const db = buildDb();
  const planned = resolveAdminSeasonContext(db, { requestedSeason: 2027, currentSeason: 2026 });
  const active = resolveAdminSeasonContext(db, { requestedSeason: 2026, currentSeason: 2026 });
  const archived = resolveAdminSeasonContext(db, { requestedSeason: 2025, currentSeason: 2026 });
  assert.throws(() => assertSeasonMutationAllowed(planned), /preparation action/);
  assert.doesNotThrow(() => assertSeasonMutationAllowed(planned, { preparation: true }));
  assert.doesNotThrow(() => assertSeasonMutationAllowed(active));
  assert.throws(() => assertSeasonMutationAllowed(archived), /read-only/);
  assert.doesNotThrow(() => assertSeasonMutationAllowed(archived, { historicalCorrection: true }));
});

test("season mutation flags require explicit request values", () => {
  assert.deepEqual(readSeasonMutationFlags({ body: {} }), {
    historicalCorrection: false,
    preparation: false
  });
  assert.deepEqual(readSeasonMutationFlags({ body: {
    historical_correction: "1",
    preparation_confirmed: "1"
  } }), {
    historicalCorrection: true,
    preparation: true
  });
});

test("archived Inputs mutations require explicit historical correction confirmation", () => {
  const db = new Database(":memory:");
  db.dialect = "sqlite";
  ensureSeasonInputsSchema(db);
  db.exec(`
    CREATE TABLE race_data_snapshots (id INTEGER PRIMARY KEY, season INTEGER NOT NULL);
    CREATE TABLE actual_snapshots (id INTEGER PRIMARY KEY, season INTEGER NOT NULL);
    CREATE TABLE actual_snapshot_values (snapshot_id INTEGER NOT NULL, question_id TEXT NOT NULL, value TEXT NOT NULL);
    INSERT INTO seasons (id, year, label, status, created_at, updated_at)
      VALUES (1, 2025, '2025', 'archived', 'now', 'now');
    INSERT INTO drivers (id, slug, given_name, family_name, display_name, created_at, updated_at)
      VALUES (1, 'archived-driver', 'Archived', 'Driver', 'Archived Driver', 'now', 'now');
    INSERT INTO season_drivers (season_id, driver_id, created_at, updated_at)
      VALUES (1, 1, 'now', 'now');
  `);

  const routes = {};
  const app = {
    get(pathname, ...handlers) { routes[`GET ${pathname}`] = handlers.at(-1); },
    post(pathname, ...handlers) { routes[`POST ${pathname}`] = handlers.at(-1); }
  };
  registerAdminRoutes(app, {
    db,
    requireAdmin: () => {},
    getCurrentUser: () => ({ id: 7 }),
    logEvent: () => {}
  });
  const update = routes["POST /admin/inputs/entity"];
  assert.equal(typeof update, "function");

  const invoke = (historicalCorrection) => {
    const response = {};
    update(
      {
        body: {
          season: "2025",
          entity_type: "driver",
          entity_id: "1",
          display_name: "Corrected Archived Driver",
          ...(historicalCorrection ? { historical_correction: "1" } : {})
        }
      },
      { redirect(location) { response.location = location; } }
    );
    return response.location;
  };

  const rejectedLocation = invoke(false);
  assert.match(rejectedLocation, /Archived\+seasons\+are\+read-only/);
  assert.equal(db.prepare("SELECT display_name FROM drivers WHERE id = 1").get().display_name, "Archived Driver");

  const acceptedLocation = invoke(true);
  assert.match(acceptedLocation, /Entity\+updated/);
  assert.equal(db.prepare("SELECT display_name FROM drivers WHERE id = 1").get().display_name, "Corrected Archived Driver");
  db.close();
});
