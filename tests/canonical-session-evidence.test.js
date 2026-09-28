"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildEvidenceBundle } = require("../src/race-data-evidence");

test("canonical session evidence retains all available session metadata", () => {
  const evidence = buildEvidenceBundle({
    data: {
      season: 2026,
      results: [{
        round: 1,
        raceName: "Australian Grand Prix",
        Results: [{
          position: "1",
          grid: "3",
          Driver: { driverId: "63", givenName: "George", familyName: "Russell" },
          Constructor: { name: "Mercedes" }
        }]
      }],
      qualifying: [],
      sprints: [],
      sessionsByRound: new Map([[
        1,
        {
          practice1: {
            sessionKey: "101",
            meetingKey: "1",
            dateStart: "2026-03-06T01:00:00Z",
            available: true,
            sourceUrl: "https://api.openf1.org/v1/session_result?session_key=101",
            rows: [{
              position: 1,
              Driver: { driverId: "63", givenName: "George", familyName: "Russell" },
              Constructor: { name: "Mercedes" }
            }]
          },
          startingGrid: {
            sessionKey: "103",
            meetingKey: "1",
            available: true,
            rows: [{
              grid: 3,
              Driver: { driverId: "63", givenName: "George", familyName: "Russell" },
              Constructor: { name: "Mercedes" }
            }]
          }
        }
      ]]),
      driverStandingsByRound: new Map(),
      constructorStandingsByRound: new Map(),
      driverOfTheDayByRound: new Map()
    },
    roster: { drivers: ["George Russell"], teams: ["Mercedes"] },
    roundNumber: 1,
    roundName: "Australian Grand Prix",
    provider: "openf1",
    providerSchema: "openf1-v1"
  });

  assert.equal(evidence.sessions.practice1.sessionKey, "101");
  assert.equal(evidence.sessions.practice1.available, true);
  assert.equal(evidence.sessions.practice1.rows[0].driver, "George Russell");
  assert.equal(evidence.sessions.startingGrid.rows[0].grid, 3);
  assert.equal(evidence.coverage.sources.practice1.count, 1);
  assert.equal(evidence.raw.provider, "openf1");
});
