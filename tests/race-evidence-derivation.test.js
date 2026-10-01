"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildPersistedDataFromEvidence } = require("../src/race-evidence-derivation");

test("persisted evidence reconstruction preserves round cutoff and result sections", () => {
  const data = buildPersistedDataFromEvidence([
    {
      round_number: 3,
      round_name: "Japanese Grand Prix",
      payload: {
        roundName: "Japanese Grand Prix",
        race: {
          date: "2026-04-05",
          circuit: "Suzuka",
          rows: [{
            driver: "driver:1",
            constructor: "team:10",
            position: 1,
            positionText: "1",
            points: 25
          }]
        },
        qualifying: { rows: [] },
        sprint: { rows: [] },
        standings: {
          drivers: [{ entity: "driver:1", position: 1, points: 25 }],
          constructors: [{ entity: "team:10", position: 1, points: 25 }]
        }
      }
    }
  ], 2026);

  assert.equal(data.season, 2026);
  assert.deepEqual(data.completedRounds, [3]);
  assert.equal(data.results[0].raceName, "Japanese Grand Prix");
  assert.equal(data.results[0].Results[0].Driver.givenName, "driver:1");
  assert.equal(data.driverStandingsByRound.get(3)[0].points, "25");
});
