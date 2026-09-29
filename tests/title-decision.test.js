"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  computeTitleDecision,
  computeTitleDecidedRacesBeforeEnd
} = require("../src/title-decision");

const defaultRules = {
  racePoints: { 1: 25, 2: 18, 3: 15 },
  sprintPoints: { 1: 8, 2: 7 },
  fastestLap: { points: 0, minimumFinish: 1, eligible: false }
};

function standing(round, leaderPoints, challengerPoints) {
  return {
    round,
    standings: [
      { entity: "Leader", points: leaderPoints },
      { entity: "Challenger", points: challengerPoints }
    ]
  };
}

function race(round, leaderPosition = 1, challengerPosition = 2) {
  return {
    round,
    rows: [
      { driver: "Leader", position: leaderPosition, status: "Finished" },
      { driver: "Challenger", position: challengerPosition, status: "Finished" }
    ]
  };
}

test("treats the selected round as the effective season end", () => {
  const result = computeTitleDecision({
    roundStandings: [standing(1, 30, 0), standing(2, 56, 30)],
    raceRowsByRound: [race(1), race(2)],
    totalRounds: 3,
    sprintRoundSet: new Set(),
    scoringRules: defaultRules,
    cutoffRound: 2,
    effectiveEndRound: 2
  });

  assert.equal(result.racesBeforeEnd, 1);
  assert.equal(result.decidedRound, 1);
});

test("does not return zero before the title is decided, and returns zero when decided at the final race", () => {
  const input = {
    roundStandings: [standing(1, 20, 0), standing(2, 38, 20), standing(3, 63, 20)],
    raceRowsByRound: [race(1), race(2), race(3)],
    totalRounds: 3,
    sprintRoundSet: new Set(),
    scoringRules: defaultRules,
    effectiveEndRound: 3
  };

  assert.equal(computeTitleDecidedRacesBeforeEnd({ ...input, cutoffRound: 1 }), null);
  assert.equal(computeTitleDecidedRacesBeforeEnd({ ...input, cutoffRound: 3 }), 0);
});

test("includes the complete remaining weekend score, including sprint points", () => {
  const result = computeTitleDecision({
    roundStandings: [standing(1, 35, 0)],
    raceRowsByRound: [race(1)],
    totalRounds: 3,
    sprintRoundSet: new Set([2]),
    scoringRules: defaultRules,
    cutoffRound: 2,
    effectiveEndRound: 3
  });

  assert.equal(result, null);
});

test("uses the season scoring tables instead of a fixed 25 point assumption", () => {
  const rules = {
    racePoints: { 1: 30, 2: 20 },
    sprintPoints: { 1: 10 },
    fastestLap: { points: 0, minimumFinish: 1, eligible: false }
  };
  assert.equal(computeTitleDecidedRacesBeforeEnd({
    roundStandings: [standing(1, 61, 0)],
    raceRowsByRound: [race(1)],
    totalRounds: 3,
    sprintRoundSet: new Set(),
    scoringRules: rules,
    cutoffRound: 1,
    effectiveEndRound: 3
  }), 2);
});

test("uses countback when a challenger can only tie on points", () => {
  const result = computeTitleDecision({
    roundStandings: [standing(2, 75, 50)],
    raceRowsByRound: [race(1, 1, 2), race(2, 1, 2)],
    totalRounds: 3,
    sprintRoundSet: new Set(),
    scoringRules: defaultRules,
    cutoffRound: 2,
    effectiveEndRound: 3
  });

  assert.equal(result.racesBeforeEnd, 1);
  assert.equal(result.decidedRound, 2);
});

test("keeps the title open when a point-tied challenger can win countback", () => {
  const result = computeTitleDecision({
    roundStandings: [standing(2, 75, 50)],
    raceRowsByRound: [race(1, 2, 1), race(2, 2, 1)],
    totalRounds: 3,
    sprintRoundSet: new Set(),
    scoringRules: defaultRules,
    cutoffRound: 2,
    effectiveEndRound: 3
  });

  assert.equal(result, null);
});
