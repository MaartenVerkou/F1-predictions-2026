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

test("title decision actuals use the selected cutoff and remain unavailable before the clinch", () => {
  const data = {
    results: [1, 2].map((round) => ({
      round,
      raceName: round === 1 ? "Australian Grand Prix" : "Chinese Grand Prix",
      Results: [
        {
          Driver: { givenName: "George", familyName: "Russell" },
          Constructor: { name: "Mercedes" },
          position: "1",
          status: "Finished"
        },
        {
          Driver: { givenName: "Kimi", familyName: "Antonelli" },
          Constructor: { name: "Mercedes" },
          position: "2",
          status: "Finished"
        }
      ]
    })),
    qualifying: [],
    sprints: [],
    driverStandingsByRound: new Map([
      [1, [
        { Driver: { givenName: "George", familyName: "Russell" }, points: "25" },
        { Driver: { givenName: "Kimi", familyName: "Antonelli" }, points: "0" }
      ]],
      [2, [
        { Driver: { givenName: "George", familyName: "Russell" }, points: "50" },
        { Driver: { givenName: "Kimi", familyName: "Antonelli" }, points: "0" }
      ]]
    ]),
    constructorStandingsByRound: new Map([[1, []], [2, []]]),
    driverOfTheDayByRound: new Map(),
    destructorsByRound: new Map()
  };
  const common = {
    questions: [question("races_before_title_decided", "numeric")],
    roster: {
      drivers: ["George Russell", "Kimi Antonelli"],
      teams: ["Mercedes"],
      team_profiles: {}
    },
    races: ["Australian Grand Prix", "Chinese Grand Prix", "Japanese Grand Prix"],
    data,
    totalRounds: 3,
    scoringRules: {
      racePoints: { 1: 25, 2: 0 },
      sprintPoints: {},
      fastestLap: { points: 0, minimumFinish: 1, eligible: false }
    }
  };

  const beforeClinch = serializedActualsForRound({ ...common, roundNumber: 1 });
  const afterClinch = serializedActualsForRound({ ...common, roundNumber: 2 });
  assert.equal(Object.prototype.hasOwnProperty.call(beforeClinch, "races_before_title_decided"), false);
  assert.equal(afterClinch.races_before_title_decided, "1");
});
