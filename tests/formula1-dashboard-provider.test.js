"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildMeetingResults,
  fetchFormula1DashboardSeasonData,
  normalizedDamageRow,
  normalizedResultRow,
  statusFor
} = require("../src/formula1-dashboard-provider");
const { buildEvidenceBundle } = require("../src/race-data-evidence");

function response(payload, { ok = true, status = 200, headers = new Map() } = {}) {
  return { ok, status, headers: { get: (name) => headers.get(name) || null }, json: async () => payload };
}

test("Formula 1 Dashboard adapter normalizes race sessions and merges starting grid", async () => {
  const meeting = {
    round: 1,
    meeting_key: 1279,
    name: "Australian Grand Prix",
    meeting_short_name: "Australia",
    start_date: "2026-03-06T05:00:00+00:00",
    state: "completed"
  };
  const rows = [
    {
      session_type: "Starting Grid", driver_id: 168, driver_name: "George Russell",
      team_name: "Mercedes", position: 4, round: 1
    },
    {
      session_type: "Race", driver_id: 168, driver_name: "George Russell",
      team_name: "Mercedes", position: 1, points: 25, completion_status_code: "OK", laps: 58, round: 1
    },
    {
      session_type: "Race", driver_id: 169, driver_name: "Kimi Antonelli",
      team_name: "Mercedes", position: 666, points: 0, completion_status_code: "DNF", laps: 15, round: 1
    },
    {
      session_type: "Qualifying", driver_id: 168, driver_name: "George Russell",
      team_name: "Mercedes", position: 2, q1_time: "1:20.1", round: 1
    },
    {
      session_type: "Sprint", driver_id: 168, driver_name: "George Russell",
      team_name: "Mercedes", position: 1, points: 8, completion_status_code: "OK", round: 1
    }
  ];
  const driverEvolution = [{
    round: 1, driver_id: 168, driver_name: "George Russell", position: 1, points: 33,
    constructor_id: 4, constructor: { name: "Mercedes" }
  }];
  const constructorEvolution = [{
    round: 1, constructor_id: 4, position: 1, points: 43,
    constructor: { name: "Mercedes" }
  }];
  const destructors = [{
    round: 1,
    driver_id: 168,
    driver_season: {
      id: 168,
      constructor_id: 4,
      driver: { name: "George Russell" },
      constructor: { name: "Mercedes" }
    },
    components: [
      { component_id: 1, name: "Front wing", price: 125000, quantity: 1 },
      { component_id: 2, name: "Floor", price: 50000, quantity: 2 }
    ]
  }];

  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.endsWith("/grand-prix")) return response([meeting]);
    if (path.endsWith("/driver-standings-evolution")) return response(driverEvolution);
    if (path.endsWith("/constructor-standings-evolution")) return response(constructorEvolution);
    if (path.endsWith("/destructors-championship")) return response(destructors);
    if (path.endsWith("/results")) return response(rows);
    throw new Error(`Unexpected URL: ${url}`);
  };

  const data = await fetchFormula1DashboardSeasonData({
    season: 2026,
    baseUrl: "https://api.example.test",
    fetchImpl,
    timeoutMs: 1000,
    retries: 0
  });

  assert.deepEqual(data.completedRounds, [1]);
  assert.equal(data.provider, "formula1_dashboard");
  assert.equal(data.results[0].Results[0].grid, 4);
  assert.equal(data.results[0].Results[1].position, "");
  assert.equal(data.results[0].Results[1].status, "DNF");
  assert.equal(data.qualifying[0].QualifyingResults[0].Q1, "1:20.1");
  assert.equal(data.sprints[0].SprintResults[0].points, 8);
  assert.equal(data.driverStandingsByRound.get(1)[0].Driver.familyName, "Russell");
  assert.equal(data.constructorStandingsByRound.get(1)[0].Constructor.name, "Mercedes");
  assert.equal(data.destructorsByRound.get(1)[0].totalCost, 225000);
  assert.equal(data.destructorsByRound.get(1)[0].driverName, "George Russell");
  assert.match(data.payloadRevisionByRound.get(1), /^[a-f0-9]{24}$/);
});

test("Formula 1 Dashboard sentinel statuses never become finishing positions", () => {
  const row = normalizedResultRow({
    driver_id: 169,
    driver_name: "Kimi Antonelli",
    team_name: "Mercedes",
    position: 666,
    completion_status_code: "DNF"
  }, "race");
  assert.equal(row.position, "");
  assert.equal(row.positionText, "DNF");
  assert.equal(statusFor({ completion_status_code: "DNS" }), "Did not start");
  assert.equal(statusFor({ completion_status_code: "DSQ" }), "Disqualified");
  assert.equal(normalizedResultRow({
    driver_id: 170,
    driver_name: "Pit Lane Driver",
    team_name: "Mercedes",
    position: 1,
    grid: 0,
    completion_status_code: "OK"
  }, "race").grid, null);
});

test("Formula 1 Dashboard destructors rows calculate component totals", () => {
  const row = normalizedDamageRow({
    round: 3,
    driver_id: 42,
    driver_season: {
      id: 42,
      constructor_id: 9,
      driver: { name: "Test Driver" },
      constructor: { name: "Test Team" }
    },
    components: [{ name: "Wing", price: 100, quantity: 3 }]
  });
  assert.equal(row.totalCost, 300);
  assert.equal(row.components[0].totalCost, 300);
  assert.equal(row.constructorName, "Test Team");
});

test("Formula 1 Dashboard does not publish a calendar round before race evidence exists", async () => {
  const meetings = [
    { round: 1, meeting_key: 1279, name: "Australian Grand Prix", meeting_short_name: "Australia", state: "completed" },
    { round: 2, meeting_key: 1280, name: "Chinese Grand Prix", meeting_short_name: "China", state: "completed" }
  ];
  const fetchImpl = async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/grand-prix")) return response(meetings);
    if (path.endsWith("/driver-standings-evolution") || path.endsWith("/constructor-standings-evolution")) return response([]);
    return response([{
      session_type: "Race", driver_id: 1, driver_name: "Test Driver", team_name: "Test Team",
      position: 1, points: 25, completion_status_code: "OK", round: 1
    }]);
  };
  const data = await fetchFormula1DashboardSeasonData({ season: 2026, baseUrl: "https://api.example.test", fetchImpl, retries: 0 });
  assert.deepEqual(data.completedRounds, [1]);
});

test("Formula 1 Dashboard surfaces a provider Cloudflare challenge without hiding it", async () => {
  const fetchImpl = async () => response("challenge", {
    ok: false,
    status: 403,
    headers: new Map([["cf-mitigated", "challenge"]])
  });
  await assert.rejects(
    fetchFormula1DashboardSeasonData({ season: 2026, baseUrl: "https://api.example.test", fetchImpl, retries: 0 }),
    /Cloudflare challenge; server access is not enabled/
  );
});

test("Formula 1 Dashboard rows become canonical persisted evidence", () => {
  const built = buildMeetingResults([
    {
      session_type: "Race", driver_id: 168, driver_name: "George Russell",
      team_name: "Mercedes", position: 1, points: 25, completion_status_code: "OK", round: 1
    }
  ], 1, {
    name: "Australian Grand Prix",
    meeting_short_name: "Australia",
    start_date: "2026-03-06T05:00:00+00:00"
  });
  const evidence = buildEvidenceBundle({
    data: {
      season: 2026,
      provider: "formula1_dashboard",
      providerSchema: "formula1dashboard-api-v1",
      results: [built.race],
      qualifying: [],
      sprints: [],
      driverStandingsByRound: new Map(),
      constructorStandingsByRound: new Map(),
      destructorsByRound: new Map([[1, [{
        round: 1,
        driverId: "168",
        driverName: "George Russell",
        constructorId: "4",
        constructorName: "Mercedes",
        components: [{ name: "Front wing", price: 125000, quantity: 1 }],
        totalCost: 125000
      }]]]),
      driverOfTheDayByRound: new Map()
    },
    roster: { drivers: ["George Russell"], teams: ["Mercedes"] },
    canonicalCatalog: {
      driver: [{ id: 1, value: "driver:1", label: "George Russell" }],
      team: [{ id: 2, value: "team:2", label: "Mercedes" }]
    },
    provider: "formula1_dashboard",
    providerSchema: "formula1dashboard-api-v1",
    provenance: { sourceIdentity: "formula1_dashboard:2026:meeting-1279" },
    roundNumber: 1,
    roundName: "Australian Grand Prix"
  });

  assert.equal(evidence.race.rows[0].driver_id, 1);
  assert.equal(evidence.race.rows[0].team_id, 2);
  assert.equal(evidence.raw.provider, "formula1_dashboard");
  assert.equal(evidence.raw.providerSchema, "formula1dashboard-api-v1");
  assert.equal(evidence.raw.provenance.sourceIdentity, "formula1_dashboard:2026:meeting-1279");
  assert.equal(evidence.external.damage.available, true);
  assert.equal(evidence.external.damage.rows[0].totalCost, 125000);
});
