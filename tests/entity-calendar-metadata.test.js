const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const {
  createOrGetSeason,
  ensureSeasonInputsSchema,
  listSeasonInputs,
  normalizeCountryCode,
  normalizeEntityCode,
  normalizeF1EntryYear,
  normalizeTeamCode,
  upsertRace,
  upsertSeasonTeam,
  upsertTeam
} = require("../src/season-inputs");

function createDb() {
  const db = new Database(":memory:");
  ensureSeasonInputsSchema(db);
  return db;
}

test("entity metadata normalizers accept canonical values and reject malformed values", () => {
  assert.equal(normalizeEntityCode(" mer ", "Team code"), "MER");
  assert.equal(normalizeTeamCode(" rbu "), "RBU");
  assert.equal(normalizeCountryCode("gbr"), "GBR");
  assert.equal(normalizeF1EntryYear("2026"), 2026);
  assert.equal(normalizeEntityCode("", "Team code"), null);
  assert.throws(() => normalizeEntityCode("too-long-code", "Team code"), /Team code/);
  assert.throws(() => normalizeTeamCode("RB"), /three letters/);
  assert.throws(() => normalizeCountryCode("GB"), /three letters/);
  assert.throws(() => normalizeF1EntryYear("1949"), /F1 entry season/);
});

test("team and race metadata persists through the season catalog", () => {
  const db = createDb();
  try {
    const season = createOrGetSeason(db, { year: 2026 });
    const teamId = upsertTeam(db, {
      displayName: "Mercedes",
      slug: "mercedes",
      teamCode: "mer",
      baseCountryCode: "gbr",
      f1EntryYear: 2010,
      powerUnit: "Mercedes"
    });
    upsertSeasonTeam(db, { seasonId: season.id, teamId, displayOrder: 1 });
    upsertRace(db, {
      seasonId: season.id,
      roundNumber: 1,
      slug: "australian-grand-prix",
      displayName: "Australian Grand Prix",
      scheduledDate: "2026-03-08T04:00:00Z",
      scheduledTimezone: "Australia/Melbourne",
      raceCode: "aus",
      countryCode: "aus",
      circuitName: "Albert Park Circuit"
    });

    const catalog = listSeasonInputs(db, 2026);
    assert.deepEqual(
      catalog.teams[0] && {
        team_code: catalog.teams[0].team_code,
        base_country_code: catalog.teams[0].base_country_code,
        f1_entry_year: catalog.teams[0].f1_entry_year,
        power_unit: catalog.teams[0].power_unit
      },
      { team_code: "MER", base_country_code: "GBR", f1_entry_year: 2010, power_unit: "Mercedes" }
    );
    assert.deepEqual(
      catalog.races[0] && {
        race_code: catalog.races[0].race_code,
        country_code: catalog.races[0].country_code,
        circuit_name: catalog.races[0].circuit_name,
        scheduled_timezone: catalog.races[0].scheduled_timezone
      },
      {
        race_code: "AUS",
        country_code: "AUS",
        circuit_name: "Albert Park Circuit",
        scheduled_timezone: "Australia/Melbourne"
      }
    );
  } finally {
    db.close();
  }
});

test("omitting metadata on a later upsert preserves researched values", () => {
  const db = createDb();
  try {
    const teamId = upsertTeam(db, {
      displayName: "Ferrari",
      slug: "ferrari",
      teamCode: "FER",
      baseCountryCode: "ITA",
      f1EntryYear: 1950,
      powerUnit: "Ferrari"
    });
    upsertTeam(db, { displayName: "Ferrari", slug: "ferrari", shortName: "Ferrari" });
    const row = db.prepare("SELECT team_code, base_country_code, f1_entry_year, power_unit FROM teams WHERE id = ?").get(teamId);
    assert.deepEqual(row, { team_code: "FER", base_country_code: "ITA", f1_entry_year: 1950, power_unit: "Ferrari" });
  } finally {
    db.close();
  }
});
