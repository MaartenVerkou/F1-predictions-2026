"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  classifySession,
  fetchOpenF1SeasonData,
  normalizeOpenF1Row,
  resolveMeetingRound
} = require("../src/openf1-provider");

function response(payload, { ok = true, status = 200, headers = new Map() } = {}) {
  return {
    ok,
    status,
    headers: { get: (name) => headers.get(name) || null },
    json: async () => payload
  };
}

test("OpenF1 classifies normal and sprint sessions from type and name", () => {
  assert.equal(classifySession({ session_type: "Practice", session_name: "Practice 1" }), "practice1");
  assert.equal(classifySession({ session_type: "Qualifying", session_name: "Sprint Qualifying" }), "sprintQualifying");
  assert.equal(classifySession({ session_type: "Race", session_name: "Sprint" }), "sprint");
  assert.equal(classifySession({ session_type: "Qualifying", session_name: "Qualifying" }), "qualifying");
  assert.equal(classifySession({ session_type: "Race", session_name: "Race" }), "race");
  assert.equal(classifySession({ session_type: "Practice", session_name: "Day 1" }), null);
});

test("OpenF1 normalizes session rows and preserves non-finish statuses", () => {
  const row = normalizeOpenF1Row({
    position: 20,
    driver_number: 44,
    number_of_laps: 0,
    dnf: true,
    dns: false,
    dsq: false,
    duration: [80.1, null, null],
    points: 0,
    meeting_key: 1279,
    session_key: 11230
  }, {
    driver_number: 44,
    full_name: "Lewis Hamilton",
    first_name: "Lewis",
    last_name: "Hamilton",
    team_name: "Ferrari"
  }, "qualifying", { sessionKey: 11230, meetingKey: 1279 });

  assert.equal(row.position, null);
  assert.equal(row.positionText, "DNF");
  assert.equal(row.Driver.driverId, "44");
  assert.equal(row.Constructor.name, "Ferrari");
  assert.deepEqual(row.qualifyingTimes, { q1: "80.1", q2: null, q3: null });
  assert.equal(row.sessionKey, "11230");
});

test("OpenF1 does not invent Finished for unclassified non-race sessions", () => {
  const row = normalizeOpenF1Row({
    position: null,
    driver_number: 14,
    number_of_laps: 6,
    dnf: false,
    dns: false,
    dsq: false,
    duration: [101.311, null, null],
    points: 0,
    meeting_key: 1279,
    session_key: 11271
  }, {
    driver_number: 14,
    full_name: "Fernando Alonso",
    first_name: "Fernando",
    last_name: "Alonso",
    team_name: "Aston Martin"
  }, "sprintQualifying", { sessionKey: 11271, meetingKey: 1279 });

  assert.equal(row.status, null);
  assert.equal(row.position, null);
  assert.equal(row.positionText, null);
});

test("OpenF1 keeps Finished as the default for classified race results", () => {
  const row = normalizeOpenF1Row({
    position: 1,
    driver_number: 63,
    number_of_laps: 57,
    dnf: false,
    dns: false,
    dsq: false,
    points: 25,
    meeting_key: 1279,
    session_key: 11234
  }, {
    driver_number: 63,
    full_name: "George Russell",
    first_name: "George",
    last_name: "Russell",
    team_name: "Mercedes"
  }, "race", { sessionKey: 11234, meetingKey: 1279 });

  assert.equal(row.status, "Finished");
  assert.equal(row.position, 1);
  assert.equal(row.positionText, "1");
});

test("OpenF1 maps a unique meeting to the configured season round", () => {
  assert.equal(resolveMeetingRound({
    meeting_name: "Australian Grand Prix",
    date_start: "2026-03-06T01:30:00Z",
    circuit_short_name: "Albert Park"
  }, [
    { round: 1, name: "Australian Grand Prix", start: "2026-03-08T04:00:00Z", circuit: "Albert Park Circuit" }
  ]), 1);
  assert.equal(resolveMeetingRound({ meeting_name: "Unknown Grand Prix", date_start: "2026-01-01T00:00:00Z" }, []), null);
});

test("OpenF1 uses configured circuit metadata when provider and display names differ", () => {
  assert.equal(resolveMeetingRound({
    meeting_name: "Barcelona Grand Prix",
    date_start: "2026-06-12T11:30:00Z",
    circuit_short_name: "Catalunya"
  }, [
    {
      round: 7,
      name: "Barcelona-Catalunya Grand Prix",
      start: "2026-06-14T13:00:00Z",
      circuit: "Circuit de Barcelona-Catalunya"
    },
    {
      round: 14,
      name: "Spanish Grand Prix",
      start: "2026-09-13T13:00:00Z",
      circuit: "Madring"
    }
  ]), 7);
});

test("OpenF1 fetch produces session projections and grid values", async () => {
  const meeting = {
    meeting_key: 1279,
    meeting_name: "Australian Grand Prix",
    date_start: "2026-03-06T01:30:00Z",
    circuit_short_name: "Albert Park"
  };
  const sessions = [
    { session_key: 11227, meeting_key: 1279, session_type: "Practice", session_name: "Practice 1", date_start: "2026-03-06T01:30:00Z" },
    { session_key: 11230, meeting_key: 1279, session_type: "Qualifying", session_name: "Qualifying", date_start: "2026-03-07T06:00:00Z" },
    { session_key: 11234, meeting_key: 1279, session_type: "Race", session_name: "Race", date_start: "2026-03-08T04:00:00Z" }
  ];
  const driver = { driver_number: 44, full_name: "Lewis Hamilton", first_name: "Lewis", last_name: "Hamilton", team_name: "Ferrari" };
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.endsWith("/meetings")) return response([meeting]);
    if (path.endsWith("/sessions")) return response(sessions);
    if (path.endsWith("/drivers")) return response([driver]);
    if (path.endsWith("/starting_grid")) return response([{ position: 4, driver_number: 44, meeting_key: 1279, session_key: 11234 }]);
    if (path.endsWith("/session_result")) {
      const key = parsed.searchParams.get("session_key");
      return response([{ position: key === "11227" ? 2 : 1, driver_number: 44, number_of_laps: 20, dnf: false, dns: false, dsq: false, points: key === "11234" ? 25 : 0, duration: 80.2, meeting_key: 1279, session_key: key }]);
    }
    throw new Error("Unexpected URL: " + url);
  };
  const data = await fetchOpenF1SeasonData({
    season: 2026,
    calendar: [{ round: 1, name: "Australian Grand Prix", start: "2026-03-08T04:00:00Z", circuit: "Albert Park Circuit" }],
    maxRound: 1,
    baseUrl: "https://api.example.test",
    fetchImpl,
    retries: 0
  });
  assert.equal(data.sessionsByRound.get(1).practice1.rows[0].position, 2);
  assert.equal(data.sessionsByRound.get(1).race.rows[0].grid, 4);
  assert.equal(data.sessionsByRound.get(1).race.rows[0].points, 25);
  assert.equal(data.sessionsByRound.get(1).practice2.status, "unavailable");
  assert.equal(data.results[0].Results[0].Driver.familyName, "Hamilton");
  assert.equal(data.sourceIdentityByRound.get(1), "openf1:2026:meeting-1279");
  assert.equal(data.sourceType, "openf1");
});

test("OpenF1 does not turn an unavailable starting-grid position into zero", async () => {
  const meeting = {
    meeting_key: 1279,
    meeting_name: "Australian Grand Prix",
    date_start: "2026-03-06T01:30:00Z",
    circuit_short_name: "Albert Park"
  };
  const sessions = [
    { session_key: 11234, meeting_key: 1279, session_type: "Race", session_name: "Race", date_start: "2026-03-08T04:00:00Z" }
  ];
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.endsWith("/meetings")) return response([meeting]);
    if (path.endsWith("/sessions")) return response(sessions);
    if (path.endsWith("/drivers")) return response([{ driver_number: 44, full_name: "Lewis Hamilton", team_name: "Ferrari" }]);
    if (path.endsWith("/starting_grid")) return response([{ position: 0, driver_number: 44, meeting_key: 1279, session_key: 11234 }]);
    if (path.endsWith("/session_result")) return response([{ position: 1, driver_number: 44, dnf: false, dns: false, dsq: false, points: 25, session_key: 11234 }]);
    throw new Error("Unexpected URL: " + url);
  };
  const data = await fetchOpenF1SeasonData({
    season: 2026,
    calendar: [{ round: 1, name: "Australian Grand Prix", start: "2026-03-08T04:00:00Z", circuit: "Albert Park" }],
    maxRound: 1,
    baseUrl: "https://api.example.test",
    fetchImpl,
    retries: 0
  });

  assert.equal(data.sessionsByRound.get(1).race.rows[0].grid, null);
  assert.equal(data.sessionsByRound.get(1).startingGrid.available, false);
});
