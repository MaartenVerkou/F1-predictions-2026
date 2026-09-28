"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  DEFAULT_SCORING_RULES,
  deriveStandingsForRounds,
  pointsForResult,
  reconcileStandings
} = require("../src/season-scoring-rules");

test("race and sprint points come from the selected season rules", () => {
  assert.equal(pointsForResult({ position: 1, status: "Finished" }, "race", DEFAULT_SCORING_RULES), 25);
  assert.equal(pointsForResult({ position: 1, status: "Finished" }, "sprint", DEFAULT_SCORING_RULES), 8);
  assert.equal(pointsForResult({ position: 1, status: "Retired" }, "race", DEFAULT_SCORING_RULES), 0);
  assert.equal(pointsForResult({ position: 11, status: "Finished" }, "race", DEFAULT_SCORING_RULES), 0);
});

test("a season-specific points table changes both race and sprint derivation", () => {
  const rules = {
    revision: "test-season-rules",
    racePoints: { 1: 30, 2: 20 },
    sprintPoints: { 1: 5 },
    fastestLap: { eligible: false, points: 0, minimumFinish: 1 }
  };
  assert.equal(pointsForResult({ position: 1, status: "Finished" }, "race", rules), 30);
  assert.equal(pointsForResult({ position: 1, status: "Finished" }, "sprint", rules), 5);
  const standings = deriveStandingsForRounds([{
    roundNumber: 1,
    raceRows: [{ driver_id: 1, driver: "A", team_id: 10, constructor: "Team A", position: 1, status: "Finished" }],
    sprintRows: [{ driver_id: 1, driver: "A", team_id: 10, constructor: "Team A", position: 1, status: "Finished" }]
  }], rules);
  assert.equal(standings.get(1).drivers[0].points, 35);
});

test("driver and constructor standings accumulate race and sprint results", () => {
  const standings = deriveStandingsForRounds([
    {
      roundNumber: 1,
      raceRows: [
        { driver_id: 1, driver: "A", team_id: 10, constructor: "Team A", position: 1, status: "Finished" },
        { driver_id: 2, driver: "B", team_id: 10, constructor: "Team A", position: 2, status: "Finished" }
      ],
      sprintRows: [{ driver_id: 2, driver: "B", team_id: 10, constructor: "Team A", position: 1, status: "Finished" }]
    },
    {
      roundNumber: 2,
      raceRows: [{ driver_id: 2, driver: "B", team_id: 10, constructor: "Team A", position: 1, status: "Finished" }],
      sprintRows: []
    }
  ], DEFAULT_SCORING_RULES);
  const roundTwo = standings.get(2);
  assert.equal(roundTwo.drivers[0].entity, "B");
  assert.equal(roundTwo.drivers[0].points, 8 + 18 + 25);
  assert.equal(roundTwo.constructors[0].points, 25 + 18 + 8 + 25);
});

test("derived provider rows keep constructor names when only Constructor is present", () => {
  const standings = deriveStandingsForRounds([{
    roundNumber: 1,
    raceRows: [{
      Driver: { driverId: "44", givenName: "Lewis", familyName: "Hamilton" },
      Constructor: { constructorId: "mercedes", name: "Mercedes" },
      position: 1,
      status: "Finished"
    }],
    sprintRows: []
  }], DEFAULT_SCORING_RULES);
  assert.equal(standings.get(1).constructors[0].entity, "Mercedes");
});

test("reconciliation distinguishes matching, changed, and missing rows", () => {
  const result = reconcileStandings(
    [{ entity_id: 1, entity: "A", points: 25 }, { entity_id: 2, entity: "B", points: 18 }],
    [{ entity_id: 1, entity: "A", points: 25 }, { entity_id: 2, entity: "B", points: 20 }, { entity_id: 3, entity: "C", points: 0 }]
  );
  assert.deepEqual(result.map((row) => row.status), ["match", "difference", "missing"]);
});
