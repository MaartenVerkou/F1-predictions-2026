"use strict";

const crypto = require("node:crypto");

const DEFAULT_BASE_URL = "https://api.formula1dashboard.com";
const PROVIDER = "formula1_dashboard";
const PROVIDER_SCHEMA = "formula1dashboard-api-v1";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 3;

function normalizeBaseUrl(value = DEFAULT_BASE_URL) {
  const base = String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(base)) {
    throw new Error("Formula 1 Dashboard API base URL must use HTTPS.");
  }
  return base;
}

function parseFinite(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePosition(value) {
  const parsed = parseFinite(value);
  return parsed != null && parsed >= 1 && parsed < 100 ? parsed : null;
}

function normalizeGrid(value) {
  const parsed = parseFinite(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed < 100 ? parsed : null;
}

function splitDriverName(row) {
  const preferred = String(row?.driver_name || "").trim();
  const fallback = String(row?.driver_full_name || "").trim();
  const name = preferred.includes(" ") ? preferred : fallback || preferred;
  const parts = name.split(/\s+/).filter(Boolean);
  return {
    givenName: parts.shift() || "",
    familyName: parts.join(" ")
  };
}

function driverRef(row) {
  const driver = splitDriverName(row);
  return {
    driverId: row?.driver_id == null ? null : String(row.driver_id),
    ...driver
  };
}

function constructorRef(row) {
  return {
    constructorId: row?.constructor_id == null
      ? (row?.driver_season?.constructor_id == null ? null : String(row.driver_season.constructor_id))
      : String(row.constructor_id),
    name: String(row?.team_name || row?.constructor_name || row?.driver_season?.constructor?.name || "").trim()
  };
}

function statusFor(row) {
  const code = String(row?.completion_status_code || "").trim().toUpperCase();
  if (code === "DNF") return "DNF";
  if (code === "DNS") return "Did not start";
  if (code === "DNQ" || code === "NOT") return "Did not qualify";
  if (code === "DSQ") return "Disqualified";
  if (code === "NC") return "Not classified";
  if (code === "WD") return "Withdrew";
  if (code === "OK" || !code) return "Finished";
  return code;
}

function normalizedResultRow(row, kind) {
  const position = normalizePosition(row?.position);
  const status = statusFor(row);
  const driver = driverRef(row);
  const constructor = constructorRef(row);
  if (!driver.givenName && !driver.familyName && !constructor.name) return null;

  const result = {
    number: row?.driver_season?.driver_number == null
      ? (row?.driver_number == null ? null : String(row.driver_number))
      : String(row.driver_season.driver_number),
    position: position == null ? "" : String(position),
    positionText: position == null ? status : String(position),
    grid: kind === "race" ? normalizeGrid(row?.grid) : null,
    points: parseFinite(row?.points, 0),
    status,
    laps: parseFinite(row?.laps),
    Driver: driver,
    Constructor: constructor
  };

  if (kind === "qualifying") {
    result.Q1 = String(row?.q1_time || "").trim() || null;
    result.Q2 = String(row?.q2_time || "").trim() || null;
    result.Q3 = String(row?.q3_time || "").trim() || null;
  }
  if (row?.time) result.Time = { time: String(row.time) };
  return result;
}

function normalizedDamageComponent(component) {
  const price = Math.max(0, parseFinite(component?.price, 0));
  const quantity = Math.max(0, parseFinite(component?.quantity, 0));
  return {
    componentId: component?.component_id == null ? null : String(component.component_id),
    name: String(component?.name || "").trim() || "Unknown component",
    price,
    quantity,
    totalCost: price * quantity
  };
}

function normalizedDamageRow(row, driverNameOverride = null) {
  const driverId = row?.driver_id ?? row?.driver_season?.id;
  const constructorId = row?.constructor_id ?? row?.driver_season?.constructor_id;
  const driverName = String(
    driverNameOverride || row?.driver_name || row?.driver_season?.driver?.full_name || row?.driver_season?.driver?.name || ""
  ).trim();
  const constructorName = String(
    row?.constructor_name || row?.driver_season?.constructor?.name || ""
  ).trim();
  const components = (Array.isArray(row?.components) ? row.components : []).map(normalizedDamageComponent);
  return {
    round: parseFinite(row?.round, null),
    driverId: driverId == null ? null : String(driverId),
    driverName,
    constructorId: constructorId == null ? null : String(constructorId),
    constructorName,
    driverNumber: row?.driver_number == null ? null : String(row.driver_number),
    grandPrixId: row?.grand_prix_id == null ? null : String(row.grand_prix_id),
    grandPrixCountry: String(row?.grand_prix?.country || "").trim() || null,
    components,
    totalCost: components.reduce((total, component) => total + component.totalCost, 0)
  };
}

function normalizedStandingsRow(row, kind) {
  const driver = driverRef({
    ...row,
    driver_name: row?.driver_name || row?.driver_season?.driver?.full_name || row?.driver_season?.driver?.name,
    driver_full_name: row?.driver_full_name || row?.driver_season?.driver?.full_name || row?.driver_season?.driver?.name,
    driver_id: row?.driver_id
  });
  const constructor = {
    constructorId: row?.constructor_id == null ? null : String(row.constructor_id),
    name: String(row?.constructor?.name || row?.driver_season?.constructor?.name || "").trim()
  };
  const entity = kind === "driver" ? driver : constructor;
  if (!entity.name && !entity.givenName && !entity.familyName) return null;
  return {
    position: normalizePosition(row?.position) == null ? "" : String(normalizePosition(row.position)),
    points: parseFinite(row?.points, 0),
    Driver: kind === "driver" ? driver : undefined,
    Constructor: constructor,
    ...(kind === "constructor" ? { Constructor: constructor } : {})
  };
}

function unwrapArray(payload, label) {
  const rows = Array.isArray(payload) ? payload : payload?.data;
  if (!Array.isArray(rows)) throw new Error(`Formula 1 Dashboard ${label} response is not an array.`);
  return rows;
}

function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}

function buildSourceUrl(baseUrl, path, params = {}) {
  const url = new URL(`${baseUrl}/api/v1/${String(path).replace(/^\/+/, "")}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function normalizeMeetingDate(value) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 10) : null;
}

function buildMeetingResults(rows, round, meeting) {
  const roundRows = rows.filter((row) => Number(row?.round) === Number(round));
  const races = roundRows.filter((row) => row?.session_type === "Race");
  const grids = roundRows.filter((row) => row?.session_type === "Starting Grid");
  const qualifying = roundRows.filter((row) => row?.session_type === "Qualifying");
  const sprints = roundRows.filter((row) => row?.session_type === "Sprint");
  const gridByDriver = new Map(grids.map((row) => [String(row?.driver_id), normalizeGrid(row?.position)]));
  const raceRows = races.map((row) => {
    const normalized = normalizedResultRow(row, "race");
    if (!normalized) return null;
    const grid = gridByDriver.get(String(row?.driver_id));
    if (grid != null) normalized.grid = grid;
    return normalized;
  }).filter(Boolean);
  const qualifyingRows = qualifying.map((row) => normalizedResultRow(row, "qualifying")).filter(Boolean);
  const sprintRows = sprints.map((row) => normalizedResultRow(row, "sprint")).filter(Boolean);

  const roundName = String(meeting?.name || `${meeting?.meeting_short_name || "Round"} Grand Prix`).trim();
  const date = normalizeMeetingDate(meeting?.start_date);
  return {
    round,
    race: {
      round,
      raceName: roundName,
      date,
      Circuit: { circuitName: String(meeting?.meeting_short_name || meeting?.city || "").trim() || null },
      Results: raceRows
    },
    qualifying: qualifyingRows.length ? { round, QualifyingResults: qualifyingRows } : null,
    sprint: sprintRows.length ? { round, SprintResults: sprintRows } : null,
    sourceRows: { raceRows, qualifyingRows, sprintRows, grids }
  };
}

async function createRequester({
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  userAgent = "f1-predictions-formula1dashboard-provider"
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Formula 1 Dashboard provider requires fetch.");
  const normalizedBase = normalizeBaseUrl(baseUrl);
  return async function request(path, params = {}) {
    const url = buildSourceUrl(normalizedBase, path, params);
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url, {
          headers: { "user-agent": userAgent, accept: "application/json" },
          signal: controller.signal
        });
        if (response.ok) {
          const payload = await response.json();
          return { payload, url };
        }
        const cloudflareChallenge = String(response.headers?.get?.("cf-mitigated") || "").toLowerCase() === "challenge";
        const detail = cloudflareChallenge
          ? " (Cloudflare challenge; server access is not enabled for this provider)"
          : "";
        const error = new Error(`Formula 1 Dashboard returned ${response.status} for ${url}${detail}`);
        if (![408, 425, 429, 500, 502, 503, 504].includes(response.status) || attempt >= retries) throw error;
        lastError = error;
      } catch (error) {
        lastError = error.name === "AbortError" ? new Error(`Formula 1 Dashboard timed out for ${url}`) : error;
        if (attempt >= retries) throw lastError;
      } finally {
        clearTimeout(timeout);
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
    throw lastError || new Error("Formula 1 Dashboard request failed.");
  };
}

async function fetchFormula1DashboardSeasonData({
  season,
  baseUrl = process.env.FORMULA1_DASHBOARD_API_BASE_URL || DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  maxRound = null
} = {}) {
  const safeSeason = Number(season);
  if (!Number.isInteger(safeSeason) || safeSeason <= 0) throw new Error("Formula 1 Dashboard season must be a positive integer.");
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const request = await createRequester({ baseUrl, fetchImpl, timeoutMs, retries });
  const calendarResponse = await request("grand-prix", { year: safeSeason });
  const meetings = unwrapArray(calendarResponse.payload, "calendar").filter((meeting) => Number(meeting?.round) > 0);
  const selectedMeetings = meetings
    .filter((meeting) => maxRound == null || Number(meeting.round) <= Number(maxRound))
    .sort((left, right) => Number(left.round) - Number(right.round));
  const driverEvolutionResponse = await request("driver-standings-evolution", { year: safeSeason });
  const constructorEvolutionResponse = await request("constructor-standings-evolution", { year: safeSeason });
  const driverEvolution = unwrapArray(driverEvolutionResponse.payload, "driver standings evolution");
  const constructorEvolution = unwrapArray(constructorEvolutionResponse.payload, "constructor standings evolution");

  const results = [];
  const qualifying = [];
  const sprints = [];
  const sourceUrlsByRound = new Map();
  const payloadRevisionByRound = new Map();
  const sourceIdentityByRound = new Map();
  const driverStandingsByRound = new Map();
  const constructorStandingsByRound = new Map();
  const completedRounds = [];
  const driverNamesById = new Map();
  const driverNamesByNumber = new Map();
  let destructorsSourceUrl = buildSourceUrl(normalizedBase, "destructors-championship", { year: safeSeason });
  let destructorsPayload = [];
  let destructorsError = null;
  try {
    const destructorsResponse = await request("destructors-championship", { year: safeSeason });
    destructorsSourceUrl = destructorsResponse.url;
    destructorsPayload = unwrapArray(destructorsResponse.payload, "destructors championship");
  } catch (error) {
    destructorsError = {
      message: String(error?.message || error),
      provider: PROVIDER,
      sourceUrl: destructorsSourceUrl
    };
  }

  for (const meeting of selectedMeetings) {
    const round = Number(meeting.round);
    const response = await request("results", {
      year: safeSeason,
      meeting_key: meeting.meeting_key,
      session_type: "Race,Qualifying,Starting Grid,Sprint"
    });
    const rows = unwrapArray(response.payload, `results for round ${round}`);
    rows.forEach((row) => {
      if (row?.driver_id != null && row?.driver_name) {
        driverNamesById.set(String(row.driver_id), String(row.driver_name));
      }
    });
    const built = buildMeetingResults(rows, round, meeting);
    [...built.race.Results, ...(built.qualifying?.QualifyingResults || []), ...(built.sprint?.SprintResults || [])]
      .forEach((result) => {
        const driverId = result?.Driver?.driverId;
        const fullName = [result?.Driver?.givenName, result?.Driver?.familyName]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (driverId != null && fullName) driverNamesById.set(String(driverId), fullName);
        if (result?.number != null && fullName) driverNamesByNumber.set(String(result.number), fullName);
      });
    const hasRace = built.race.Results.length > 0;
    // A calendar state is not enough to publish evidence: some providers mark
    // a meeting completed before the result session is available. Only a
    // non-empty race result set is safe as the completed-round boundary.
    if (hasRace) completedRounds.push(round);
    results.push(built.race);
    if (built.qualifying) qualifying.push(built.qualifying);
    if (built.sprint) sprints.push(built.sprint);

    const driverRows = driverEvolution
      .filter((row) => Number(row?.round) === round)
      .map((row) => normalizedStandingsRow({
        ...row,
        driver_name: driverNamesById.get(String(row?.driver_id)) || row?.driver_name
      }, "driver"))
      .filter(Boolean);
    const constructorRows = constructorEvolution
      .filter((row) => Number(row?.round) === round)
      .map((row) => normalizedStandingsRow(row, "constructor"))
      .filter(Boolean);
    driverStandingsByRound.set(round, driverRows);
    constructorStandingsByRound.set(round, constructorRows);

    sourceUrlsByRound.set(round, {
      race: response.url,
      qualifying: response.url,
      sprint: response.url,
      startingGrid: response.url,
      damage: destructorsSourceUrl,
      driverStandings: buildSourceUrl(normalizedBase, "driver-standings-evolution", { year: safeSeason }),
      constructorStandings: buildSourceUrl(normalizedBase, "constructor-standings-evolution", { year: safeSeason })
    });
    sourceIdentityByRound.set(round, `${PROVIDER}:${safeSeason}:meeting-${meeting.meeting_key}`);
    payloadRevisionByRound.set(round, stableHash({
      round,
      meeting,
      race: built.race,
      qualifying: built.qualifying,
      sprint: built.sprint,
      driverStandings: driverRows,
      constructorStandings: constructorRows
    }));
  }

  const destructors = destructorsPayload
    .map((row) => normalizedDamageRow(
      row,
      driverNamesByNumber.get(String(row?.driver_number))
        || driverNamesById.get(String(row?.driver_id ?? row?.driver_season?.id))
        || null
    ))
    .filter((row) => row.round != null && row.driverName && row.constructorName);
  const destructorsByRound = new Map();
  destructors.forEach((row) => {
    if (!destructorsByRound.has(row.round)) destructorsByRound.set(row.round, []);
    destructorsByRound.get(row.round).push(row);
  });
  payloadRevisionByRound.forEach((_, round) => {
    const meeting = selectedMeetings.find((item) => Number(item.round) === Number(round));
    const race = results.find((item) => Number(item.round) === Number(round));
    payloadRevisionByRound.set(round, stableHash({
      round,
      meeting,
      race,
      damage: destructorsByRound.get(round) || [],
      driverStandings: driverStandingsByRound.get(round) || [],
      constructorStandings: constructorStandingsByRound.get(round) || []
    }));
  });

  return {
    season: safeSeason,
    provider: PROVIDER,
    providerSchema: PROVIDER_SCHEMA,
    sourceType: PROVIDER,
    sourceNote: "Formula 1 Dashboard API; unofficial external evidence provider",
    results,
    qualifying,
    sprints,
    destructors,
    destructorsByRound,
    destructorsError,
    destructorsSourceUrl,
    completedRounds: Array.from(new Set(completedRounds)).sort((a, b) => a - b),
    driverStandingsByRound,
    constructorStandingsByRound,
    driverOfTheDayByRound: new Map(),
    sourceUrlsByRound,
    sourceIdentityByRound,
    payloadRevisionByRound,
    driverOfTheDayUrl: null
  };
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_RETRIES,
  PROVIDER,
  PROVIDER_SCHEMA,
  buildMeetingResults,
  fetchFormula1DashboardSeasonData,
  normalizeBaseUrl,
  normalizeGrid,
  normalizePosition,
  normalizedResultRow,
  normalizedDamageComponent,
  normalizedDamageRow,
  normalizedStandingsRow,
  statusFor,
  stableHash
};
