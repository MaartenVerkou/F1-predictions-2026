const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const {
  createOrGetSeason,
  ensureSeasonInputsSchema,
  listSeasonInputs,
  upsertRace
} = require("../src/season-inputs");

test("race schedule stores the instant and venue timezone", () => {
  const db = new Database(":memory:");
  try {
    ensureSeasonInputsSchema(db);
    const season = createOrGetSeason(db, { year: 2026, label: "2026" });

    upsertRace(db, {
      seasonId: season.id,
      roundNumber: 1,
      slug: "australian-grand-prix",
      displayName: "Australian Grand Prix",
      scheduledDate: "2026-03-08T04:00:00Z",
      scheduledTimezone: "Australia/Melbourne"
    });
    upsertRace(db, {
      seasonId: season.id,
      roundNumber: 2,
      slug: "future-race",
      displayName: "Future Race"
    });

    const races = listSeasonInputs(db, 2026).races;
    assert.equal(races[0].scheduled_date, "2026-03-08T04:00:00Z");
    assert.equal(races[0].scheduled_timezone, "Australia/Melbourne");
    assert.equal(races[1].scheduled_date, null);
    assert.equal(races[1].scheduled_timezone, null);
    assert.ok(db.prepare("PRAGMA table_info(races)").all().some((column) => column.name === "scheduled_timezone"));
  } finally {
    db.close();
  }
});
