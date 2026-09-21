"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildPersistedDataFromEvidence,
  compareSnapshotValues
} = require("../scripts/backfill-actuals-2026");

test("snapshot comparison reports new, changed, and unchanged values", () => {
  assert.deepEqual(compareSnapshotValues(null, { q1: "A" }), {
    status: "new",
    existingCount: 0,
    derivedCount: 1,
    unchangedCount: 0,
    changedCount: 1,
    addedCount: 1,
    removedCount: 0
  });
  assert.deepEqual(compareSnapshotValues({ q1: "A", q2: "B" }, { q1: "A", q2: "C" }), {
    status: "changed",
    existingCount: 2,
    derivedCount: 2,
    unchangedCount: 1,
    changedCount: 1,
    addedCount: 0,
    removedCount: 0
  });
  assert.equal(compareSnapshotValues({ q1: "A" }, { q1: "A" }).status, "unchanged");
});

test("persisted evidence reconstructs derivation input without provider objects", () => {
  const data = buildPersistedDataFromEvidence([{
    round_number: 6,
    round_name: "Monaco Grand Prix",
    payload: {
      roundName: "Monaco Grand Prix",
      race: {
        date: "2026-05-24",
        circuit: "Circuit de Monaco",
        rows: [{
          driver: "Kimi Antonelli",
          constructor: "Mercedes",
          position: 1,
          positionText: "1",
          grid: 3,
          points: 25,
          status: "Finished",
          laps: 78
        }]
      },
      qualifying: { rows: [] },
      sprint: { rows: [] },
      standings: {
        drivers: [{ entity: "Kimi Antonelli", position: 1, points: 25 }],
        constructors: [{ entity: "Mercedes", position: 1, points: 25 }]
      },
      external: { driverOfTheDay: "Kimi Antonelli" }
    }
  }], 2026);

  assert.equal(data.results.length, 1);
  assert.equal(data.results[0].Results[0].Driver.givenName, "Kimi");
  assert.equal(data.results[0].Results[0].Constructor.name, "Mercedes");
  assert.equal(data.driverStandingsByRound.get(6)[0].Driver.familyName, "Antonelli");
  assert.equal(data.constructorStandingsByRound.get(6)[0].Constructor.name, "Mercedes");
  assert.equal(data.driverOfTheDayByRound.get(6), "Kimi Antonelli");
});
