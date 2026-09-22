const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertHistoricalCorrection,
  assertAssignmentIntervals,
  buildLineupProjection,
  buildLineupPlan,
  buildTeamLineupHistory,
  buildTeamLineupHistoryPlan,
  historicalCorrectionRequired
} = require("../src/season-lineup");

const teams = [
  { id: 10, display_name: "Alpha", display_order: 1 },
  { id: 20, display_name: "Beta", display_order: 2 }
];
const drivers = [
  { id: 1, display_name: "Driver A" },
  { id: 2, display_name: "Driver B" },
  { id: 3, display_name: "Driver C" },
  { id: 4, display_name: "Driver D" }
];
const assignments = [
  { id: 101, season_id: 2026, team_id: 10, driver_id: 1, seat_number: 1, from_round: 1, to_round: null },
  { id: 102, season_id: 2026, team_id: 10, driver_id: 2, seat_number: 2, from_round: 1, to_round: null },
  { id: 103, season_id: 2026, team_id: 20, driver_id: 3, seat_number: 1, from_round: 1, to_round: null }
];

test("projection shows two team seats at the selected round", () => {
  const projection = buildLineupProjection({ teams, drivers, assignments, roundNumber: 4 });
  assert.deepEqual(projection.map((row) => row.seats.map((seat) => seat.driverId)), [[1, 2], [3, null]]);
});

test("season presentation changes keep the canonical driver identity", () => {
  const projection = buildLineupProjection({
    teams: [{ id: 10, display_name: "Alpha", display_order: 1 }],
    drivers: [{ id: 1, display_name: "Renamed Driver", driver_number: "99" }],
    assignments: [{ id: 301, team_id: 10, driver_id: 1, seat_number: 1, from_round: 1, to_round: null }],
    roundNumber: 3
  });
  assert.equal(projection[0].seats[0].driverId, 1);
  assert.equal(projection[0].seats[0].driverName, "Renamed Driver");
});

test("replacement plan closes the old interval and starts at the selected round", () => {
  const plan = buildLineupPlan({
    teams,
    drivers,
    assignments,
    roundNumber: 6,
    desiredSeats: [
      { teamId: 10, seatNumber: 1, driverId: 3 },
      { teamId: 10, seatNumber: 2, driverId: 2 },
      { teamId: 20, seatNumber: 1, driverId: null },
      { teamId: 20, seatNumber: 2, driverId: null }
    ]
  });
  assert.deepEqual(plan.operations, [
    { type: "close", assignmentId: 101, toRound: 5 },
    { type: "close", assignmentId: 103, toRound: 5 },
    { type: "insert", teamId: 10, seatNumber: 1, driverId: 3, fromRound: 6 }
  ]);
});

test("swap plan validates the final lineup before writes", () => {
  const plan = buildLineupPlan({
    teams,
    drivers,
    assignments,
    roundNumber: 6,
    desiredSeats: [
      { teamId: 10, seatNumber: 1, driverId: 2 },
      { teamId: 10, seatNumber: 2, driverId: 1 },
      { teamId: 20, seatNumber: 1, driverId: 3 },
      { teamId: 20, seatNumber: 2, driverId: null }
    ]
  });
  assert.equal(plan.operations.filter((operation) => operation.type === "insert").length, 2);
  assert.equal(plan.operations.filter((operation) => operation.type === "close").length, 2);
});

test("plan rejects duplicate driver occupancy", () => {
  assert.throws(() => buildLineupPlan({
    teams,
    drivers,
    assignments,
    roundNumber: 6,
    desiredSeats: [
      { teamId: 10, seatNumber: 1, driverId: 1 },
      { teamId: 10, seatNumber: 2, driverId: 1 },
      { teamId: 20, seatNumber: 1, driverId: 3 },
      { teamId: 20, seatNumber: 2, driverId: null }
    ]
  }), /Driver 1 is assigned to more than one active seat/);
});

test("projection respects the replacement round cutoff", () => {
  const projection = buildLineupProjection({
    teams,
    drivers,
    assignments: [
      { id: 201, team_id: 10, driver_id: 1, seat_number: 1, from_round: 1, to_round: 5 },
      { id: 202, team_id: 10, driver_id: 3, seat_number: 1, from_round: 6, to_round: null }
    ],
    roundNumber: 5
  });
  assert.equal(projection[0].seats[0].driverId, 1);
  assert.equal(buildLineupProjection({
    teams,
    drivers,
    assignments: [
      { id: 201, team_id: 10, driver_id: 1, seat_number: 1, from_round: 1, to_round: 5 },
      { id: 202, team_id: 10, driver_id: 3, seat_number: 1, from_round: 6, to_round: null }
    ],
    roundNumber: 6
  })[0].seats[0].driverId, 3);
});

test("assignment interval validation rejects overlapping driver and seat history", () => {
  assert.throws(() => assertAssignmentIntervals([
    { id: 1, driver_id: 1, team_id: 10, seat_number: 1, from_round: 1, to_round: 5 },
    { id: 2, driver_id: 1, team_id: 20, seat_number: 1, from_round: 5, to_round: null }
  ]), /overlapping team assignments/);
  assert.throws(() => assertAssignmentIntervals([
    { id: 1, driver_id: 1, team_id: 10, seat_number: 1, from_round: 1, to_round: null },
    { id: 2, driver_id: 2, team_id: 10, seat_number: 1, from_round: 2, to_round: null }
  ]), /seat 1 has overlapping/);
  assert.doesNotThrow(() => assertAssignmentIntervals([
    { id: 1, driver_id: 1, team_id: 10, seat_number: 1, from_round: 1, to_round: 4 },
    { id: 2, driver_id: 1, team_id: 20, seat_number: 1, from_round: 5, to_round: null }
  ]));
});

test("empty seat closes the active assignment without inserting a driver", () => {
  const plan = buildLineupPlan({
    teams,
    drivers,
    assignments,
    roundNumber: 6,
    desiredSeats: [
      { teamId: 10, seatNumber: 1, driverId: 1 },
      { teamId: 10, seatNumber: 2, driverId: null },
      { teamId: 20, seatNumber: 1, driverId: 3 },
      { teamId: 20, seatNumber: 2, driverId: null }
    ]
  });
  assert.deepEqual(plan.operations, [{ type: "close", assignmentId: 102, toRound: 5 }]);
});

test("historical corrections require explicit confirmation", () => {
  assert.equal(historicalCorrectionRequired({ roundNumber: 6, reviewedRounds: [6], evidenceRounds: [] }), true);
  assert.throws(() => assertHistoricalCorrection({ roundNumber: 6, evidenceRounds: [8] }), /Historical correction confirmation is required/);
  assert.doesNotThrow(() => assertHistoricalCorrection({ roundNumber: 6, evidenceRounds: [8], historicalCorrectionConfirmed: true }));
});

test("team history groups periods by seat in chronological order", () => {
  const history = buildTeamLineupHistory({
    teams,
    drivers,
    assignments: [
      { id: 402, team_id: 10, driver_id: 2, seat_number: 1, from_round: 7, to_round: null },
      { id: 401, team_id: 10, driver_id: 1, seat_number: 1, from_round: 1, to_round: 6 },
      { id: 403, team_id: 10, driver_id: 3, seat_number: 2, from_round: 1, to_round: null }
    ]
  });
  assert.deepEqual(history[0].seats[1].map((period) => [period.driverId, period.fromRound, period.toRound]), [[1, 1, 6], [2, 7, null]]);
  assert.equal(history[0].seats[2][0].driverName, "Driver C");
});

test("team history plan preserves stable rows and inserts a replacement period", () => {
  const plan = buildTeamLineupHistoryPlan({
    teams,
    drivers,
    assignments,
    teamId: 10,
    seasonRoundCount: 22,
    seatPeriods: {
      1: [
        { id: 101, driverId: 1, fromRound: 1, toRound: 5 },
        { driverId: 4, fromRound: 6 }
      ],
      2: [{ id: 102, driverId: 2, fromRound: 1 }]
    }
  });
  assert.deepEqual(plan.operations.map((operation) => operation.type), ["update", "insert"]);
  assert.equal(plan.operations[0].assignmentId, 101);
  assert.equal(plan.operations[1].fromRound, 6);
  assert.equal(plan.affectedFromRound, 1);
});

test("team history rejects overlapping periods before writing", () => {
  assert.throws(() => buildTeamLineupHistoryPlan({
    teams,
    drivers,
    assignments,
    teamId: 10,
    seasonRoundCount: 22,
    seatPeriods: {
      1: [
        { id: 101, driverId: 1, fromRound: 1, toRound: 6 },
        { driverId: 4, fromRound: 6 }
      ],
      2: [{ id: 102, driverId: 2, fromRound: 1 }]
    }
  }), /seat 1 has overlapping/);
});

test("team history rejects a driver assigned to another team in the same period", () => {
  assert.throws(() => buildTeamLineupHistoryPlan({
    teams,
    drivers,
    assignments,
    teamId: 10,
    seasonRoundCount: 22,
    seatPeriods: {
      1: [{ id: 101, driverId: 3, fromRound: 1 }],
      2: [{ id: 102, driverId: 2, fromRound: 1 }]
    }
  }), /overlapping team assignments/);
});

test("team history plan can remove all assignments for one seat", () => {
  const plan = buildTeamLineupHistoryPlan({
    teams,
    drivers,
    assignments,
    teamId: 10,
    seasonRoundCount: 22,
    seatPeriods: { 1: [], 2: [{ id: 102, driverId: 2, fromRound: 1 }] }
  });
  assert.deepEqual(plan.operations, [{ type: "delete", assignmentId: 101, fromRound: 1, toRound: null }]);
});
