"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { serializedActualsForRound } = require("../scripts/backfill-actuals-2026");

function question(id, type = "single_choice") {
  return { id, type };
}

function emptyData(results) {
  return {
    results,
    qualifying: [],
    sprints: [],
    driverStandingsByRound: new Map([[1, []], [2, []]]),
    constructorStandingsByRound: new Map([[1, []], [2, []]]),
    driverOfTheDayByRound: new Map(),
    destructorsByRound: new Map()
  };
}

test("grid-winner derivation keeps missing grids unavailable instead of inventing zero", () => {
  const values = serializedActualsForRound({
    questions: [question("lowest_grid_win_position", "single_choice_with_driver")],
    roster: { drivers: ["George Russell"], teams: ["Mercedes"], team_profiles: {} },
    races: ["Australian Grand Prix"],
    data: emptyData([{
      round: 1,
      raceName: "Australian Grand Prix",
      Results: [{
        Driver: { givenName: "George", familyName: "Russell" },
        Constructor: { name: "Mercedes" },
        position: "1",
        grid: null,
        status: "Finished"
      }]
    }]),
    roundNumber: 1,
    totalRounds: 1
  });

  assert.equal(Object.prototype.hasOwnProperty.call(values, "lowest_grid_win_position"), false);
});

test("grid sentinel zero is treated as unavailable", () => {
  const values = serializedActualsForRound({
    questions: [question("lowest_grid_win_position", "single_choice_with_driver")],
    roster: { drivers: ["George Russell"], teams: ["Mercedes"], team_profiles: {} },
    races: ["Australian Grand Prix"],
    data: emptyData([{
      round: 1,
      raceName: "Australian Grand Prix",
      Results: [{
        Driver: { givenName: "George", familyName: "Russell" },
        Constructor: { name: "Mercedes" },
        position: "1",
        grid: "0",
        status: "Finished"
      }]
    }]),
    roundNumber: 1,
    totalRounds: 1
  });

  assert.equal(Object.prototype.hasOwnProperty.call(values, "lowest_grid_win_position"), false);
});

test("grid-winner derivation deduplicates a driver who wins the same best grid more than once", () => {
  const values = serializedActualsForRound({
    questions: [question("lowest_grid_win_position", "single_choice_with_driver")],
    roster: {
      drivers: ["George Russell", "Kimi Antonelli"],
      teams: ["Mercedes"],
      team_profiles: {}
    },
    races: ["Australian Grand Prix", "Chinese Grand Prix"],
    data: emptyData([
      {
        round: 1,
        raceName: "Australian Grand Prix",
        Results: [{
          Driver: { givenName: "George", familyName: "Russell" },
          Constructor: { name: "Mercedes" },
          position: "1",
          grid: "2",
          status: "Finished"
        }]
      },
      {
        round: 2,
        raceName: "Chinese Grand Prix",
        Results: [{
          Driver: { givenName: "George", familyName: "Russell" },
          Constructor: { name: "Mercedes" },
          position: "1",
          grid: "2",
          status: "Finished"
        }]
      }
    ]),
    roundNumber: 2,
    totalRounds: 2
  });

  assert.deepEqual(JSON.parse(values.lowest_grid_win_position), {
    value: "2",
    driver: "George Russell"
  });
});
