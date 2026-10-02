"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildRaceDataAuditView } = require("../src/routes/admin");

function evidence(round, damageRows) {
  return {
    id: round,
    round_number: round,
    coverage_status: "complete",
    payload: {
      coverage: { status: "complete", sources: { damage: { available: true, count: damageRows.length } } },
      race: { rows: [] },
      qualifying: { rows: [] },
      sprint: { rows: [] },
      external: { damage: { available: true, rows: damageRows, error: null } },
      standings: {
        drivers: [
          { entity: "Driver A", position: 1, points: 25 },
          { entity: "Driver B", position: 2, points: 18 }
        ],
        constructors: [{ entity: "Team A", position: 1, points: 43 }]
      }
    }
  };
}

test("damage focus projects the same costs for driver and constructor views", () => {
  const damage = [
    { round: 1, driver: "Driver A", constructor: "Team A", totalCost: 125000 },
    { round: 1, driver: "Driver B", constructor: "Team A", totalCost: 50000 }
  ];
  const common = {
    races: ["Australian Grand Prix"],
    roster: {
      drivers: ["Driver A", "Driver B"],
      teams: ["Team A"],
      driver_entities: [
        { id: 1, name: "Driver A", teamId: 10, teamName: "Team A", seatNumber: 1 },
        { id: 2, name: "Driver B", teamId: 10, teamName: "Team A", seatNumber: 2 }
      ],
      team_entities: [{ id: 10, name: "Team A" }]
    },
    evidenceRows: [evidence(1, damage)],
    snapshotRows: [],
    selectedRound: 1,
    focus: { metric: "damage", matrixMetric: "damage", view: "drivers", highlightMode: "rows", footerMode: "sum" }
  };
  const drivers = buildRaceDataAuditView(common);
  assert.equal(drivers.drivers[0].name, "Driver A");
  assert.equal(drivers.drivers[0].cells[0].label, "$125K");
  assert.equal(drivers.drivers[0].summaryValue, 125000);
  assert.equal(drivers.focusFooter.total, 175000);
  assert.equal(drivers.focusFooter.totalDisplay, "$175K");

  const constructors = buildRaceDataAuditView({ ...common, focus: { ...common.focus, view: "constructors" } });
  assert.equal(constructors.constructors[0].cells[0].label, "$175K");
  assert.equal(constructors.constructors[0].summaryValue, 175000);
  assert.equal(constructors.focusFooter.totalDisplay, "$175K");
});

test("damage focus keeps missing provider evidence unavailable", () => {
  const view = buildRaceDataAuditView({
    races: ["Australian Grand Prix"],
    roster: { drivers: ["Driver A"], teams: ["Team A"] },
    evidenceRows: [{
      ...evidence(1, []),
      payload: {
        ...evidence(1, []).payload,
        external: { damage: { available: false, rows: [], error: { message: "source unavailable" } } }
      }
    }],
    snapshotRows: [],
    selectedRound: 1,
    focus: { metric: "damage", matrixMetric: "damage", view: "drivers", highlightMode: "rows", footerMode: "sum" }
  });
  assert.equal(view.drivers[0].cells[0].label, "—");
  assert.equal(view.drivers[0].cells[0].state, "incomplete");
});
