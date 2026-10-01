"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPersistedDataFromEvidence } = require("../src/race-evidence-derivation");

test("persisted evidence derives legacy projections from the canonical sessions map", () => {
  const data = buildPersistedDataFromEvidence([{
    round_number: 1,
    round_name: "Australian Grand Prix",
    payload: {
      roundName: "Australian Grand Prix",
      sessions: {
        practice1: { available: true, rows: [{ driver: "George Russell", constructor: "Mercedes", position: 1 }] },
        sprintQualifying: { available: true, rows: [{ driver: "George Russell", constructor: "Mercedes", position: 2 }] },
        qualifying: { available: true, rows: [{ driver: "George Russell", constructor: "Mercedes", position: 3 }] },
        startingGrid: { available: true, rows: [{ driver: "George Russell", constructor: "Mercedes", grid: 3 }] },
        race: { available: true, rows: [{ driver: "George Russell", constructor: "Mercedes", position: 1, grid: 3, points: 25 }] }
      },
      standings: { drivers: [], constructors: [] }
    }
  }], 2026);

  assert.equal(data.results[0].Results[0].position, "1");
  assert.equal(data.qualifying[0].QualifyingResults[0].position, "3");
  assert.equal(data.sessionsByRound.get(1).practice1.rows[0].position, 1);
  assert.equal(data.sessionsByRound.get(1).startingGrid.rows[0].grid, 3);
});
