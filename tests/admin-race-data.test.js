"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  auditResultLabel,
  auditSourceState,
  buildRaceDataFocusOptions,
  resolveRaceDataFocus,
  buildRaceDataAuditView,
  registerAdminRoutes
} = require("../src/routes/admin");

test("auditResultLabel preserves classified and non-classified outcomes", () => {
  assert.equal(auditResultLabel({ position: 2, status: "Finished" }), "2");
  assert.equal(auditResultLabel({ position: null, status: "Retired" }), "Ret");
  assert.equal(auditResultLabel({ position: null, status: "Did not start" }), "DNS");
  assert.equal(auditResultLabel({ position: 18, status: "Retired" }), "Ret");
  assert.equal(auditResultLabel({ position: 20, status: "Did not qualify" }), "DNQ");
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

test("selected summary reflects partial and cancelled calendar states", () => {
  const evidence = (round, calendarState, coverageStatus = "complete") => ({
    id: round,
    round_number: round,
    calendar_state: calendarState,
    coverage_status: coverageStatus,
    payload: {
      coverage: { status: coverageStatus, sources: {} },
      race: { rows: [] },
      qualifying: { rows: [] },
      sprint: { rows: [] },
      standings: { drivers: [], constructors: [] }
    }
  });
  const partial = buildRaceDataAuditView({
    races: ["Austrian Grand Prix"],
    roster: { drivers: [], teams: [] },
    evidenceRows: [evidence(1, "partial")],
    snapshotRows: [],
    selectedRound: 1
  });
  const cancelled = buildRaceDataAuditView({
    races: ["Belgian Grand Prix"],
    roster: { drivers: [], teams: [] },
    evidenceRows: [evidence(1, "cancelled")],
    snapshotRows: [],
    selectedRound: 1
  });
  assert.equal(partial.selectedSummary.status, "incomplete");
  assert.equal(cancelled.selectedSummary.status, "cancelled");
});

test("auditSourceState distinguishes an older missing round from a future round", () => {
  assert.equal(auditSourceState(null, 2, 4), "not_synced");
  assert.equal(auditSourceState(null, 5, 4), "future");
});

test("buildRaceDataAuditView uses selected cutoff standings and mutes later rounds", () => {
  const bundle = (round, points) => ({
    id: round,
    round_number: round,
    coverage_status: "complete",
    payload: {
      coverage: { status: "complete", sources: {} },
      race: { rows: [{ driver: "Kimi Antonelli", constructor: "Mercedes", position: 1, positionText: "1", points: 25, grid: 1, status: "Finished" }] },
      qualifying: { rows: [] },
      sprint: { rows: [] },
      standings: { drivers: [{ entity: "Kimi Antonelli", position: 1, points }], constructors: [{ entity: "Mercedes", position: 1, points }] }
    }
  });
  const view = buildRaceDataAuditView({
    races: ["Australian Grand Prix", "Chinese Grand Prix"],
    roster: { drivers: ["Kimi Antonelli"], teams: ["Mercedes"] },
    evidenceRows: [bundle(1, 25), bundle(2, 75)],
    snapshotRows: [],
    selectedRound: 1
  });
  assert.equal(view.drivers[0].points, 25);
  assert.equal(view.drivers[0].championshipPosition, 1);
  assert.equal(view.drivers[0].cells[1].state, "future");
  assert.equal(view.constructors[0].cells[1].label, "25");
  assert.equal(view.constructors[0].cells[1].afterCutoff, true);
  assert.equal(view.drivers[0].constructorCode, "MER");
  assert.equal(view.constructors[0].code, "MER");
  assert.deepEqual(view.constructors[0].cells[0].markers, []);
  assert.equal(view.constructors[0].cells[0].podiumPosition, 1);
  assert.equal(view.constructors[0].cells[0].podiumMarkerGlyph, "1");
  assert.deepEqual(view.constructors[0].podiumSummary, { wins: 1, podiums: 1 });
  assert.equal(view.cutoffRoundNumber, 1);
});

test("constructor podiums use Grand Prix finishes, not sprint-only results, and respect cutoff", () => {
  const evidence = (round, racePosition, sprintPosition) => ({
    id: round,
    round_number: round,
    coverage_status: "complete",
    payload: {
      coverage: { status: "complete", sources: {} },
      race: {
        rows: [{
          driver: "Driver Alpha",
          constructor: "Team A",
          position: racePosition,
          points: racePosition === 2 ? 18 : 8,
          status: "Finished"
        }]
      },
      qualifying: { rows: [] },
      sprint: {
        rows: [{
          driver: "Driver Alpha",
          constructor: "Team A",
          position: sprintPosition,
          points: 8,
          status: "Finished"
        }]
      },
      standings: {
        drivers: [{ entity: "Driver Alpha", position: round, points: round === 1 ? 16 : 42 }],
        constructors: [{ entity: "Team A", position: 1, points: round === 1 ? 16 : 42 }]
      }
    }
  });
  const view = buildRaceDataAuditView({
    races: ["Australian Grand Prix", "Chinese Grand Prix"],
    roster: { drivers: ["Driver Alpha"], teams: ["Team A"] },
    evidenceRows: [evidence(1, 4, 1), evidence(2, 2, 1)],
    snapshotRows: [],
    selectedRound: 1
  });

  const constructor = view.constructors[0];
  assert.equal(constructor.cells[0].podiumPosition, null);
  assert.equal(constructor.cells[0].podiumMarkerGlyph, "");
  assert.deepEqual(constructor.podiumSummary, { wins: 0, podiums: 0 });
  assert.equal(constructor.cells[1].afterCutoff, true);
  assert.equal(constructor.cells[1].podiumPosition, null);
});

test("race data rows follow selected points and expose pole, fastest lap, and cutoff state", () => {
  const view = buildRaceDataAuditView({
    races: ["Australian Grand Prix", "Chinese Grand Prix"],
    roster: {
      drivers: ["Driver Alpha", "Driver Beta", "Driver DNQ"],
      teams: ["Team A"]
    },
    evidenceRows: [{
      id: 1,
      round_number: 1,
      coverage_status: "complete",
      payload: {
        coverage: { status: "complete", sources: {} },
        race: {
          rows: [
            { driver: "Driver Alpha", constructor: "Team A", position: 2, points: 18, status: "Finished" },
            { driver: "Driver Beta", constructor: "Team A", position: 1, points: 25, status: "Finished", fastestLap: true }
          ]
        },
        qualifying: {
          rows: [
            { driver: "Driver Beta", position: 1, pole: true },
            { driver: "Driver DNQ", status: "Did not qualify", position: null }
          ]
        },
        sprint: { rows: [] },
        standings: {
          drivers: [
            { entity: "Driver Beta", position: 1, points: 25 },
            { entity: "Driver Alpha", position: 2, points: 18 }
          ],
          constructors: [{ entity: "Team A", position: 1, points: 43 }]
        }
      }
    }],
    snapshotRows: [],
    selectedRound: 1
  });

  assert.equal(view.drivers[0].name, "Driver Beta");
  assert.equal(view.drivers[0].cells[0].pole, true);
  assert.equal(view.drivers[0].cells[0].fastestLap, true);
  assert.deepEqual(view.drivers[0].cells[0].markers, ["P", "FL"]);
  assert.equal(view.drivers[0].cells[0].markerGlyph, "P FL");
  assert.equal(view.drivers[0].cells[1].afterCutoff, true);
  assert.equal(view.drivers[0].cells[1].state, "future");
  assert.equal(view.drivers.find((row) => row.name === "Driver DNQ").cells[0].label, "DNQ");
});

test("constructor detail groups the canonical two-seat lineup and merges team summary data", () => {
  const view = buildRaceDataAuditView({
    races: ["Australian Grand Prix"],
    roster: {
      drivers: ["Driver Alpha", "Driver Beta"],
      teams: ["Team A"],
      driver_entities: [
        { id: 101, name: "Driver Alpha", code: "ALP", teamId: 201, teamName: "Team A", seatNumber: 1 },
        { id: 102, name: "Driver Beta", code: "BET", teamId: 201, teamName: "Team A", seatNumber: 2 }
      ],
      team_entities: [{ id: 201, name: "Team A", code: "TMA" }]
    },
    evidenceRows: [{
      id: 1,
      round_number: 1,
      coverage_status: "complete",
      payload: {
        coverage: { status: "complete", sources: {} },
        race: {
          rows: [
            { driver_id: 101, driver: "Driver Alpha", team_id: 201, constructor: "Team A", position: 1, points: 25, status: "Finished" },
            { driver_id: 102, driver: "Driver Beta", team_id: 201, constructor: "Team A", position: 2, points: 18, status: "Finished" }
          ]
        },
        qualifying: { rows: [] },
        sprint: { rows: [] },
        standings: {
          drivers: [
            { entity_id: 101, entity: "Driver Alpha", position: 1, points: 25 },
            { entity_id: 102, entity: "Driver Beta", position: 2, points: 18 }
          ],
          constructors: [{ entity_id: 201, entity: "Team A", position: 1, points: 43 }]
        }
      }
    }],
    snapshotRows: [],
    selectedRound: 1
  });

  assert.equal(view.constructorGroups.length, 1);
  assert.equal(view.constructorGroups[0].summary.name, "Team A");
  assert.equal(view.constructorGroups[0].summary.points, 43);
  assert.deepEqual(
    view.constructorGroups[0].drivers.map((driver) => [driver.name, driver.seatNumber]),
    [["Driver Alpha", 1], ["Driver Beta", 2]]
  );
  assert.equal(view.constructorGroups[0].drivers[0].cells[0].label, "1");
  assert.equal(view.constructorGroups[0].drivers[1].cells[0].label, "2");
});

test("constructor detail fills an unassigned seat without inventing a driver result", () => {
  const view = buildRaceDataAuditView({
    races: ["Australian Grand Prix"],
    roster: {
      driver_entities: [{ id: 101, name: "Driver Alpha", teamId: 201, teamName: "Team A", seatNumber: 1 }],
      team_entities: [{ id: 201, name: "Team A", code: "TMA" }]
    },
    evidenceRows: [],
    snapshotRows: [],
    selectedRound: 1
  });

  const drivers = view.constructorGroups[0].drivers;
  assert.equal(drivers.length, 2);
  assert.equal(drivers[0].name, "Driver Alpha");
  assert.equal(drivers[1].isEmpty, true);
  assert.equal(drivers[1].name, "—");
  assert.equal(drivers[1].seatNumber, 2);
});

test("race data is exposed as a read-only admin workspace", () => {
  const routes = {};
  const app = {
    get(pathname, ...handlers) { routes[`GET ${pathname}`] = handlers.at(-1); },
    post(pathname, ...handlers) { routes[`POST ${pathname}`] = handlers.at(-1); }
  };
  registerAdminRoutes(app, {
    db: {},
    requireAdmin: () => {},
    getCurrentUser: () => ({ id: 1 }),
    logEvent: () => {}
  });

  assert.equal(typeof routes["GET /admin/race-data"], "function");
  assert.equal(routes["POST /admin/race-data"], undefined);
});

test("race data focus options are driven by question metadata", () => {
  const questions = [
    {
      id: "all_podium_finishers",
      prompt: "Select all podium finishers",
      race_data_focus: { view: "drivers", metric: "podiums" }
    },
    {
      id: "constructors_championship_top_3",
      prompt: "Constructors' Championship: pick your Top 3",
      race_data_focus: { view: "constructors", metric: "points" }
    }
  ];
  const options = buildRaceDataFocusOptions(questions, { pointsLabel: "Championship points" });
  assert.deepEqual(options.map((option) => [option.id, option.view, option.metric]), [
    ["points", "all", "points"],
    ["all_podium_finishers", "drivers", "podiums"],
    ["constructors_championship_top_3", "constructors", "points"]
  ]);
  assert.equal(resolveRaceDataFocus({
    questions,
    focusId: "all_podium_finishers",
    viewMode: "drivers"
  }).metric, "podiums");
  assert.equal(resolveRaceDataFocus({
    questions,
    focusId: "all_podium_finishers",
    viewMode: "constructors"
  }).id, "points");
});

test("last championship focus inverts the championship order", () => {
  const view = buildRaceDataAuditView({
    races: ["Spanish Grand Prix"],
    roster: {
      driver_entities: [
        { id: 1, name: "Lance Stroll", teamId: 10, teamName: "Aston Martin", seatNumber: 1 },
        { id: 2, name: "Valtteri Bottas", teamId: 11, teamName: "Cadillac", seatNumber: 1 },
        { id: 3, name: "Sergio Perez", teamId: 12, teamName: "Cadillac", seatNumber: 2 }
      ],
      team_entities: [
        { id: 10, name: "Aston Martin", code: "AMR" },
        { id: 11, name: "Cadillac", code: "CAD" },
        { id: 12, name: "Cadillac", code: "CAD" }
      ]
    },
    evidenceRows: [{
      id: 1,
      round_number: 1,
      coverage_status: "complete",
      payload: {
        coverage: { status: "complete", sources: {} },
        race: {
          rows: [
            { driver_id: 1, driver: "Lance Stroll", constructor: "Aston Martin", position: 21, points: 0, status: "Retired" },
            { driver_id: 2, driver: "Valtteri Bottas", constructor: "Cadillac", position: 18, points: 0, status: "Lapped" },
            { driver_id: 3, driver: "Sergio Perez", constructor: "Cadillac", position: 20, points: 0, status: "Retired" }
          ]
        },
        qualifying: { rows: [] },
        sprint: { rows: [] },
        standings: {
          drivers: [
            { entity_id: 1, entity: "Lance Stroll", position: 21, points: 0 },
            { entity_id: 2, entity: "Valtteri Bottas", position: 22, points: 0 },
            { entity_id: 3, entity: "Sergio Perez", position: 23, points: 0 }
          ],
          constructors: []
        }
      }
    }],
    snapshotRows: [],
    selectedRound: 1,
    focus: {
      id: "drivers_championship_last",
      view: "drivers",
      metric: "last_standing",
      matrixMetric: "points",
      sort: "asc"
    }
  });

  assert.equal(view.focusSummary.value, "Sergio Perez · P23");
  assert.deepEqual(view.drivers.map((row) => row.name), [
    "Sergio Perez",
    "Valtteri Bottas",
    "Lance Stroll"
  ]);
});

test("podium focus projects binary results, counts podiums, and preserves cutoff", () => {
  const evidence = (round, rows) => ({
    id: round,
    round_number: round,
    coverage_status: "complete",
    payload: {
      coverage: { status: "complete", sources: {} },
      race: { rows },
      qualifying: { rows: [] },
      sprint: { rows: [] },
      standings: { drivers: [], constructors: [] }
    }
  });
  const view = buildRaceDataAuditView({
    races: ["Australian Grand Prix", "Chinese Grand Prix", "Japanese Grand Prix"],
    roster: {
      driver_entities: [
        { id: 101, name: "Driver Alpha", code: "ALP", teamId: 201, teamName: "Team A", seatNumber: 1 },
        { id: 102, name: "Driver Beta", code: "BET", teamId: 201, teamName: "Team A", seatNumber: 2 }
      ],
      team_entities: [{ id: 201, name: "Team A", code: "TMA" }]
    },
    evidenceRows: [
      evidence(1, [
        { driver_id: 101, driver: "Driver Alpha", team_id: 201, constructor: "Team A", position: 1, points: 25, status: "Finished" },
        { driver_id: 102, driver: "Driver Beta", team_id: 201, constructor: "Team A", position: 4, points: 12, status: "Finished" }
      ]),
      evidence(2, [
        { driver_id: 101, driver: "Driver Alpha", team_id: 201, constructor: "Team A", position: 2, points: 18, status: "Finished" },
        { driver_id: 102, driver: "Driver Beta", team_id: 201, constructor: "Team A", position: 3, points: 15, status: "Finished" }
      ])
    ],
    snapshotRows: [],
    selectedRound: 2,
    focus: { id: "all_podium_finishers", view: "drivers", metric: "podiums", label: "Podiums" }
  });

  assert.equal(view.focusId, "all_podium_finishers");
  assert.equal(view.drivers[0].name, "Driver Alpha");
  assert.equal(view.drivers[0].summaryValue, 2);
  assert.deepEqual(view.drivers[0].cells.map((cell) => cell.label), ["1", "1", "—"]);
  assert.equal(view.drivers[0].cells[0].focusHit, true);
  assert.deepEqual(view.drivers[1].cells.map((cell) => cell.label), ["0", "1", "—"]);
  assert.equal(view.drivers[1].summaryValue, 1);
  assert.equal(view.drivers[1].cells[0].markerGlyph, "");
  assert.equal(view.drivers[1].cells[2].afterCutoff, true);
});

test("question focus projections expose DNF and grid-winner facts without changing evidence", () => {
  const evidence = {
    id: 1,
    round_number: 1,
    coverage_status: "complete",
    payload: {
      coverage: { status: "complete", sources: {} },
      race: {
        rows: [
          { driver_id: 101, driver: "Driver Alpha", constructor: "Team A", position: 1, grid: 12, points: 25, status: "Finished" },
          { driver_id: 102, driver: "Driver Beta", constructor: "Team A", position: null, grid: 4, points: 0, status: "Retired" }
        ]
      },
      qualifying: { rows: [] },
      sprint: { rows: [] },
      standings: {
        drivers: [
          { entity_id: 101, entity: "Driver Alpha", position: 1, points: 25 },
          { entity_id: 102, entity: "Driver Beta", position: 2, points: 0 }
        ],
        constructors: [{ entity_id: 201, entity: "Team A", position: 1, points: 25 }]
      }
    }
  };
  const roster = {
    driver_entities: [
      { id: 101, name: "Driver Alpha", teamId: 201, teamName: "Team A", seatNumber: 1 },
      { id: 102, name: "Driver Beta", teamId: 201, teamName: "Team A", seatNumber: 2 }
    ],
    team_entities: [{ id: 201, name: "Team A", code: "TMA" }]
  };
  const dnfView = buildRaceDataAuditView({
    races: ["Australian Grand Prix"],
    roster,
    evidenceRows: [evidence],
    snapshotRows: [],
    selectedRound: 1,
    focus: { id: "most_dnfs_driver", view: "drivers", metric: "dnfs", matrixMetric: "dnfs", sort: "desc" }
  });
  assert.equal(dnfView.drivers.find((row) => row.name === "Driver Beta").cells[0].label, "1");
  assert.equal(dnfView.drivers.find((row) => row.name === "Driver Beta").summaryValue, 1);
  assert.equal(dnfView.drivers.find((row) => row.name === "Driver Alpha").cells[0].label, "0");
  assert.match(dnfView.focusSummary.value, /Driver Beta/);

  const gridView = buildRaceDataAuditView({
    races: ["Australian Grand Prix"],
    roster,
    evidenceRows: [evidence],
    snapshotRows: [],
    selectedRound: 1,
    focus: { id: "lowest_grid_win_position", view: "drivers", metric: "grid_wins", matrixMetric: "grid_wins" }
  });
  assert.equal(gridView.drivers.find((row) => row.name === "Driver Alpha").cells[0].label, "12");
  assert.equal(gridView.drivers.find((row) => row.name === "Driver Alpha").summaryValue, 12);
  assert.equal(gridView.drivers.find((row) => row.name === "Driver Alpha").summaryLabel, "12");
  assert.equal(gridView.focusSummary.value, "12 · Driver Alpha");
});

test("qualifying focus compares constructor teammates in the shared matrix", () => {
  const view = buildRaceDataAuditView({
    races: ["Australian Grand Prix"],
    roster: {
      driver_entities: [
        { id: 101, name: "Driver Alpha", teamId: 201, teamName: "Team A", seatNumber: 1 },
        { id: 102, name: "Driver Beta", teamId: 201, teamName: "Team A", seatNumber: 2 }
      ],
      team_entities: [{ id: 201, name: "Team A", code: "TMA" }]
    },
    evidenceRows: [{
      id: 1,
      round_number: 1,
      coverage_status: "complete",
      payload: {
        coverage: { status: "complete", sources: {} },
        race: { rows: [] },
        qualifying: { rows: [
          { driver_id: 101, driver: "Driver Alpha", team_id: 201, constructor: "Team A", position: 5 },
          { driver_id: 102, driver: "Driver Beta", team_id: 201, constructor: "Team A", position: 8 }
        ] },
        sprint: { rows: [] },
        standings: { drivers: [], constructors: [{ entity_id: 201, entity: "Team A", position: 1, points: 0 }] }
      }
    }],
    snapshotRows: [],
    selectedRound: 1,
    focus: { id: "closest_qualifying_teammates", view: "constructors", metric: "qualifying_h2h", matrixMetric: "qualifying_h2h", sort: "asc" }
  });
  assert.equal(view.constructors[0].summaryValue, 1);
  assert.equal(view.constructors[0].cells[0].label, "5–8");
  assert.equal(view.constructorGroups[0].drivers[0].cells[0].label, "5");
  assert.equal(view.constructorGroups[0].drivers[1].cells[0].label, "8");
  assert.equal(view.constructorGroups[0].drivers[1].cells[0].podiumMarkerGlyph, "");
  assert.equal(view.focusSummary.value, "Team A · 1");
});

test("count and sprint focus projections expose cutoff-aware additive footers", () => {
  const evidence = (round, raceRows, sprintRows = []) => ({
    id: round,
    round_number: round,
    coverage_status: "complete",
    payload: {
      coverage: { status: "complete", sources: {} },
      race: { rows: raceRows },
      qualifying: { rows: [] },
      sprint: { rows: sprintRows },
      standings: { drivers: [], constructors: [] }
    }
  });
  const roster = {
    driver_entities: [
      { id: 101, name: "Driver Alpha", teamId: 201, teamName: "Team A", seatNumber: 1 },
      { id: 102, name: "Driver Beta", teamId: 201, teamName: "Team A", seatNumber: 2 }
    ],
    team_entities: [{ id: 201, name: "Team A", code: "TMA" }]
  };
  const rows = [
    { driver_id: 101, driver: "Driver Alpha", team_id: 201, constructor: "Team A", position: 1, points: 25, status: "Finished" },
    { driver_id: 102, driver: "Driver Beta", team_id: 201, constructor: "Team A", position: null, points: 0, status: "Retired" }
  ];
  const dnfView = buildRaceDataAuditView({
    races: ["Australian Grand Prix", "Chinese Grand Prix"],
    roster,
    evidenceRows: [
      evidence(1, rows),
      evidence(2, rows)
    ],
    snapshotRows: [],
    selectedRound: 1,
    focus: { id: "most_dnfs_driver", view: "drivers", metric: "dnfs", matrixMetric: "dnfs", footerMode: "count" }
  });
  assert.equal(dnfView.focusFooter.mode, "count");
  assert.deepEqual(dnfView.focusFooter.cells.map((cell) => cell.label), ["1", "—"]);
  assert.equal(dnfView.focusFooter.total, 1);
  assert.equal(dnfView.focusFooter.totalLabel, "Through cutoff");

  const sprintView = buildRaceDataAuditView({
    races: ["Australian Grand Prix", "Chinese Grand Prix"],
    roster,
    evidenceRows: [
      evidence(1, rows, [{ driver_id: 101, driver: "Driver Alpha", points: 3 }]),
      evidence(2, rows, [{ driver_id: 101, driver: "Driver Alpha", points: 4 }])
    ],
    snapshotRows: [],
    selectedRound: 2,
    focus: { id: "mini_q4_sprint_champion_same", view: "drivers", metric: "sprint_points", matrixMetric: "sprint_points", footerMode: "sum" }
  });
  assert.deepEqual(sprintView.focusFooter.cells.map((cell) => cell.label), ["3", "4"]);
  assert.equal(sprintView.focusFooter.total, 7);
});

test("teammate points focus renders per-round championship points without a footer", () => {
  const evidence = (round, points, sprintPoints) => ({
    id: round,
    round_number: round,
    coverage_status: "complete",
    payload: {
      coverage: { status: "complete", sources: {} },
      race: {
        rows: [
          { driver_id: 101, driver: "Driver Alpha", team_id: 201, constructor: "Team A", position: 1, points, status: "Finished" },
          { driver_id: 102, driver: "Driver Beta", team_id: 201, constructor: "Team A", position: 2, points: 18, status: "Finished" }
        ]
      },
      qualifying: { rows: [] },
      sprint: { rows: sprintPoints == null ? [] : [{ driver_id: 101, driver: "Driver Alpha", points: sprintPoints }] },
      standings: {
        drivers: [
          { entity_id: 101, entity: "Driver Alpha", position: 1, points: points + (sprintPoints || 0) + (round === 2 ? 20 : 0) },
          { entity_id: 102, entity: "Driver Beta", position: 2, points: 36 }
        ],
        constructors: [{ entity_id: 201, entity: "Team A", position: 1, points: 61 }]
      }
    }
  });
  const view = buildRaceDataAuditView({
    races: ["Australian Grand Prix", "Chinese Grand Prix"],
    roster: {
      driver_entities: [
        { id: 101, name: "Driver Alpha", teamId: 201, teamName: "Team A", seatNumber: 1 },
        { id: 102, name: "Driver Beta", teamId: 201, teamName: "Team A", seatNumber: 2 }
      ],
      team_entities: [{ id: 201, name: "Team A", code: "TMA" }]
    },
    evidenceRows: [evidence(1, 10, 3), evidence(2, 5, 4)],
    snapshotRows: [],
    selectedRound: 2,
    focus: {
      id: "teammate_battle",
      view: "drivers",
      metric: "teammate_points",
      matrixMetric: "points",
      cellMode: "points",
      footerMode: "none",
      compareDrivers: ["Driver Alpha", "Driver Beta"]
    }
  });
  const alpha = view.drivers.find((row) => row.name === "Driver Alpha");
  assert.deepEqual(alpha.cells.map((cell) => cell.label), ["13", "9"]);
  assert.equal(alpha.cells[0].focusHit, true);
  assert.equal(view.focusFooter, null);
});
