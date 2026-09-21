"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildEvidenceBundle,
  summarizeEvidence
} = require("../src/race-data-evidence");

const roster = {
  drivers: ["Kimi Antonelli", "Carlos Sainz Jr."],
  teams: ["Mercedes", "Williams"]
};

test("buildEvidenceBundle normalizes race, qualifying, and standings evidence", () => {
  const evidence = buildEvidenceBundle({
    data: {
      season: 2026,
      results: [{
        round: 6,
        raceName: "Monaco Grand Prix",
        date: "2026-05-24",
        Circuit: { circuitName: "Circuit de Monaco" },
        Results: [
          {
            position: "1",
            grid: "1",
            points: "25",
            status: "Finished",
            Driver: { givenName: "Andrea Kimi", familyName: "Antonelli" },
            Constructor: { name: "Mercedes" }
          },
          {
            position: "Retired",
            grid: "4",
            points: "0",
            status: "Retired",
            Driver: { givenName: "Carlos", familyName: "Sainz" },
            Constructor: { name: "Williams" }
          }
        ]
      }],
      qualifying: [{
        round: 6,
        QualifyingResults: [
          {
            position: "1",
            Driver: { givenName: "Andrea Kimi", familyName: "Antonelli" },
            Constructor: { name: "Mercedes" }
          }
        ]
      }],
      sprints: [],
      driverStandingsByRound: new Map([[
        6,
        [
          {
            position: "1",
            points: "25",
            Driver: { givenName: "Andrea Kimi", familyName: "Antonelli" }
          }
        ]
      ]]),
      constructorStandingsByRound: new Map([[
        6,
        [
          {
            position: "1",
            points: "25",
            Constructor: { name: "Mercedes" }
          }
        ]
      ]]),
      driverOfTheDayByRound: new Map()
    },
    roster,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    fetchedAt: "2026-09-21T00:00:00.000Z",
    sourceUrls: { race: "https://example.test/race" }
  });

  assert.equal(evidence.season, 2026);
  assert.equal(evidence.roundNumber, 6);
  assert.equal(evidence.coverage.status, "complete");
  assert.equal(evidence.coverage.sources.race.count, 2);
  assert.equal(evidence.coverage.sources.qualifying.count, 1);
  assert.equal(evidence.coverage.sources.sprint.available, false);
  assert.equal(evidence.race.rows[0].driver, "Kimi Antonelli");
  assert.equal(evidence.race.rows[1].driver, "Carlos Sainz Jr.");
  assert.equal(evidence.race.rows[1].position, null);
  assert.equal(evidence.race.rows[1].status, "Retired");
  assert.equal(evidence.sourceUrls.race, "https://example.test/race");
});

test("summarizeEvidence reports source row counts", () => {
  const summary = summarizeEvidence({
    coverage: {
      status: "incomplete",
      sources: {
        race: { count: 20 },
        qualifying: { count: 20 },
        sprint: { count: 0 },
        driverStandings: { count: 20 },
        constructorStandings: { count: 10 }
      }
    }
  });
  assert.deepEqual(summary, {
    status: "incomplete",
    raceCount: 20,
    qualifyingCount: 20,
    sprintCount: 0,
    driverStandingsCount: 20,
    constructorStandingsCount: 10
  });
});
