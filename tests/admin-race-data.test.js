"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  auditResultLabel,
  auditSourceState,
  buildRaceDataAuditView
} = require("../src/routes/admin");

test("auditResultLabel preserves classified and non-classified outcomes", () => {
  assert.equal(auditResultLabel({ position: 2, status: "Finished" }), "2");
  assert.equal(auditResultLabel({ position: null, status: "Retired" }), "Ret");
  assert.equal(auditResultLabel({ position: null, status: "Did not start" }), "DNS");
  assert.equal(auditResultLabel(null), "—");
});

test("buildRaceDataAuditView marks missing and future evidence without inventing results", () => {
  const view = buildRaceDataAuditView({
    races: ["Monaco Grand Prix", "Spanish Grand Prix", "Italian Grand Prix", "Abu Dhabi Grand Prix"],
    roster: {
      drivers: ["Kimi Antonelli", "Carlos Sainz Jr."],
      teams: ["Mercedes", "Williams"]
    },
    evidenceRows: [{
      id: 1,
      round_number: 1,
      coverage_status: "complete",
      fetched_at: "2026-09-21T00:00:00.000Z",
      payload: {
        coverage: { status: "complete", sources: {} },
        race: {
          rows: [{
            driver: "Kimi Antonelli",
            constructor: "Mercedes",
            position: 1,
            positionText: "1",
            points: 25,
            grid: 1,
            status: "Finished"
          }]
        },
        qualifying: { rows: [] },
        sprint: { rows: [] },
        standings: {
          drivers: [{ entity: "Kimi Antonelli", position: 1, points: 25 }],
          constructors: [{ entity: "Mercedes", position: 1, points: 25 }]
        }
      }
    }, {
      id: 2,
      round_number: 3,
      coverage_status: "incomplete",
      fetched_at: "2026-09-21T00:00:00.000Z",
      payload: {
        coverage: { status: "incomplete", sources: {} },
        race: { rows: [] },
        qualifying: { rows: [] },
        sprint: { rows: [] },
        standings: { drivers: [], constructors: [] }
      }
    }],
    snapshotRows: [{ id: 10, round_number: 1 }],
    selectedRound: 1
  });

  assert.equal(view.rounds[0].state, "complete");
  assert.equal(view.rounds[1].state, "not_synced");
  assert.equal(view.rounds[2].state, "incomplete");
  assert.equal(view.rounds[3].state, "future");
  assert.equal(view.drivers[0].cells[0].label, "1");
  assert.equal(view.drivers[1].cells[0].label, "—");
  assert.equal(view.selectedRound.label, "R1 - Monaco Grand Prix");
  assert.equal(view.detailRows[0].racePoints, 25);
  assert.equal(view.selectedRound.snapshot.id, 10);
});

test("auditSourceState distinguishes an older missing round from a future round", () => {
  assert.equal(auditSourceState(null, 2, 4), "not_synced");
  assert.equal(auditSourceState(null, 5, 4), "future");
});
