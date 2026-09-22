const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertSeasonMutationAllowed,
  listAdminSeasons,
  readSeasonMutationFlags,
  resolveAdminSeasonContext
} = require("../src/admin-season-context");

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
