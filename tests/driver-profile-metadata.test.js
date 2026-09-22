const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");

const {
  calculateDriverAge,
  createOrGetSeason,
  ensureSeasonInputsSchema,
  listSeasonInputs,
  normalizeDateOfBirth,
  normalizeDriverCode,
  normalizeNationalityCode,
  upsertDriver,
  upsertRace,
  upsertSeasonDriver
} = require("../src/season-inputs");

test("driver profile metadata normalizes and validates canonical fields", () => {
  assert.equal(normalizeDriverCode(" rus "), "RUS");
  assert.equal(normalizeNationalityCode("gbr"), "GBR");
  assert.equal(normalizeDateOfBirth("1998-02-15"), "1998-02-15");
  assert.equal(normalizeDriverCode(""), null);
  assert.equal(normalizeNationalityCode(""), null);
  assert.equal(normalizeDateOfBirth(""), null);
  assert.throws(() => normalizeDriverCode("RUS1"), /three letters/);
  assert.throws(() => normalizeNationalityCode("GB"), /three letters/);
  assert.throws(() => normalizeDateOfBirth("1998-02-31"), /valid date/);
  const db = new Database(":memory:");
  try {
    ensureSeasonInputsSchema(db);
    assert.throws(() => upsertDriver(db, { slug: "bad-driver", displayName: "Bad Driver", driverCode: "RUS1" }), /three letters/);
  } finally {
    db.close();
  }
});

test("driver age is derived from the selected season reference race", () => {
  const db = new Database(":memory:");
  try {
    ensureSeasonInputsSchema(db);
    const season = createOrGetSeason(db, { year: 2026, label: "2026" });
    const driverId = upsertDriver(db, {
      slug: "george-russell",
      displayName: "George Russell",
      driverCode: "RUS",
      nationalityCode: "GBR",
      dateOfBirth: "1998-02-15"
    });
    upsertSeasonDriver(db, { seasonId: season.id, driverId, driverNumber: "63" });
    upsertRace(db, {
      seasonId: season.id,
      roundNumber: 1,
      slug: "australian-grand-prix",
      displayName: "Australian Grand Prix",
      scheduledDate: "2026-03-08T04:00:00Z"
    });
    const driver = listSeasonInputs(db, 2026).drivers[0];
    assert.equal(driver.driver_code, "RUS");
    assert.equal(driver.nationality_code, "GBR");
    assert.equal(driver.date_of_birth, "1998-02-15");
    assert.equal(driver.age, 28);
    assert.equal(calculateDriverAge("1998-02-15", "2026-03-08"), 28);
  } finally {
    db.close();
  }
});

test("driver age is unavailable when date of birth is missing", () => {
  const db = new Database(":memory:");
  try {
    ensureSeasonInputsSchema(db);
    const season = createOrGetSeason(db, { year: 2026, label: "2026" });
    const driverId = upsertDriver(db, { slug: "unknown-driver", displayName: "Unknown Driver" });
    upsertSeasonDriver(db, { seasonId: season.id, driverId, driverNumber: "99" });
    assert.equal(listSeasonInputs(db, 2026).drivers[0].age, null);
  } finally {
    db.close();
  }
});
