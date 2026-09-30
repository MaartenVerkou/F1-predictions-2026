"use strict";

const crypto = require("node:crypto");

const DEFAULT_BASE_URL = "https://api.openf1.org";
const PROVIDER = "openf1";
const PROVIDER_SCHEMA = "openf1-v1";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 5;
const DEFAULT_MIN_INTERVAL_MS = 1000;
const MAX_RETRY_AFTER_MS = 30_000;
const SESSION_KEYS = [
  "practice1",
  "practice2",
  "practice3",
  "sprintQualifying",
  "sprint",
  "qualifying",
  "startingGrid",
  "race"
];

function normalizeBaseUrl(value = DEFAULT_BASE_URL) {
  const base = String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(base)) throw new Error("OpenF1 API base URL must use HTTPS.");
  return base;
}

function parseFinite(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeGridPosition(value) {
  const parsed = parseFinite(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed < 100 ? parsed : null;
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function classifySession(session) {
  const type = String(session?.session_type || "").trim().toLowerCase();
  const name = String(session?.session_name || "").trim().toLowerCase();
  const combined = type + " " + name;
  if (/^practice\s*1$/.test(name) || /\bpractice\s*1\b/.test(combined)) return "practice1";
  if (/^practice\s*2$/.test(name) || /\bpractice\s*2\b/.test(combined)) return "practice2";
  if (/^practice\s*3$/.test(name) || /\bpractice\s*3\b/.test(combined)) return "practice3";
  if (name.includes("sprint qualifying") || name.includes("sprint shootout") || combined.includes("sprint qualifying")) return "sprintQualifying";
  if (name === "sprint" || (type === "race" && /\bsprint\b/.test(name))) return "sprint";
  if (name === "qualifying" || (type === "qualifying" && !name.includes("sprint"))) return "qualifying";
  if (name === "race" || (type === "race" && !name.includes("sprint"))) return "race";
  return null;
}

function statusFor(row, kind) {
  if (row?.dns) return "DNS";
  if (row?.dsq) return "DSQ";
  if (row?.dnf) return "DNF";
  const isRaceResult = kind === "race" || kind === "sprint";
  if (!isRaceResult) return null;

  // OpenF1 can return a race row with all boolean status flags false while
  // leaving position null for a driver who was not officially classified.
  // A missing finish position must not be presented as a classified finish.
  const position = parseFinite(row?.position);
  return position != null && position > 0 ? "Finished" : "NC";
}

function timingValue(value) {
  if (value == null || value === "") return null;
  const parsed = parseFinite(value);
  return parsed == null ? String(value) : String(parsed);
}

function driverName(driver) {
  const full = String(driver?.full_name || "").trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    return { givenName: parts.shift() || "", familyName: parts.join(" ") };
  }
  return {
    givenName: String(driver?.first_name || "").trim(),
    familyName: String(driver?.last_name || "").trim()
  };
}

function normalizeOpenF1Row(row, driver = null, kind, {
  sessionKey = row?.session_key,
  meetingKey = row?.meeting_key
} = {}) {
  const status = statusFor(row, kind);
  const numericPosition = parseFinite(row?.position);
  const classifiedPosition = numericPosition != null && numericPosition > 0 ? numericPosition : null;
  const isRaceResult = kind === "race" || kind === "sprint";
  const position = isRaceResult
    ? classifiedPosition
    : (status == null ? classifiedPosition : null);
  const names = driverName(driver);
  const driverId = row?.driver_number ?? driver?.driver_number;
  const constructorName = String(driver?.team_name || "").trim();
  const duration = Array.isArray(row?.duration) ? row.duration : null;
  const normalized = {
    number: driverId == null ? null : String(driverId),
    position,
    positionText: position == null ? status : String(position),
    grid: null,
    points: parseFinite(row?.points, 0),
    status,
    laps: parseFinite(row?.number_of_laps),
    Driver: {
      driverId: driverId == null ? null : String(driverId),
      givenName: names.givenName,
      familyName: names.familyName
    },
    Constructor: { constructorId: null, name: constructorName },
    sessionKey: sessionKey == null ? null : String(sessionKey),
    meetingKey: meetingKey == null ? null : String(meetingKey),
    providerDriverNumber: driverId == null ? null : String(driverId),
    sessionTimeSeconds: duration ? timingValue(duration[0]) : timingValue(row?.duration),
    sessionGap: Array.isArray(row?.gap_to_leader) ? row.gap_to_leader.map(timingValue) : timingValue(row?.gap_to_leader)
  };
  if (kind === "qualifying" || kind === "sprintQualifying") {
    normalized.qualifyingTimes = {
      q1: duration ? timingValue(duration[0]) : null,
      q2: duration ? timingValue(duration[1]) : null,
      q3: duration ? timingValue(duration[2]) : null
    };
    normalized.Q1 = normalized.qualifyingTimes.q1;
    normalized.Q2 = normalized.qualifyingTimes.q2;
    normalized.Q3 = normalized.qualifyingTimes.q3;
  }
  return normalized;
}

function resolveMeetingRound(meeting, calendar = []) {
  const meetingName = normalizeName(meeting?.meeting_name || meeting?.name);
  const circuitName = normalizeName(meeting?.circuit_short_name || meeting?.location);
  const meetingDate = String(meeting?.date_start || "").slice(0, 10);
  const candidates = (calendar || []).map((race) => {
    const raceName = normalizeName(race?.name || race?.raceName);
    const raceCircuit = normalizeName(race?.circuit || race?.circuitName);
    const raceDate = String(race?.start || race?.date || race?.dateStart || "").slice(0, 10);
    const exactName = Boolean(raceName && meetingName && raceName === meetingName);
    const looseName = Boolean(
      raceName && meetingName && (raceName.includes(meetingName) || meetingName.includes(raceName))
    );
    const circuitMatch = Boolean(
      raceCircuit && circuitName && (raceCircuit.includes(circuitName) || circuitName.includes(raceCircuit))
    );
    const dateMatch = Boolean(meetingDate && raceDate && meetingDate === raceDate);
    let score = 0;
    if (exactName) score += 100;
    else if (looseName) score += 40;
    if (circuitMatch) score += 80;
    if (dateMatch) score += 60;
    return { race, score, exactName, looseName, circuitMatch, dateMatch };
  }).filter((candidate) => candidate.score > 0);
  if (!candidates.length) return null;
  const bestScore = Math.max(...candidates.map((candidate) => candidate.score));
  const best = candidates.filter((candidate) => candidate.score === bestScore);
  return best.length === 1 ? Number(best[0].race.round) : null;
}

function unwrapArray(payload, label) {
  const rows = Array.isArray(payload) ? payload : payload?.data;
  if (!Array.isArray(rows)) throw new Error("OpenF1 " + label + " response is not an array.");
  return rows;
}

function buildSourceUrl(baseUrl, path, params = {}) {
  const url = new URL(baseUrl + "/v1/" + String(path).replace(/^\/+/, ""));
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function calendarEntryForRound(calendar, round) {
  const entry = (calendar || []).find((race) => Number(race?.round) === Number(round));
  if (entry == null) return {};
  if (typeof entry === "string") return { name: entry };
  return entry;
}

function apiRowsForSession(session) {
  return Array.isArray(session?.rows) ? session.rows : [];
}

function buildOpenF1RaceTables({ sessionsByRound, calendar = [] } = {}) {
  const results = [];
  const qualifying = [];
  const sprints = [];
  for (const [round, sessions] of sessionsByRound instanceof Map ? sessionsByRound : []) {
    const calendarEntry = calendarEntryForRound(calendar, round);
    const raceName = String(
      calendarEntry.name || calendarEntry.raceName || ("Round " + round)
    ).trim();
    const metadata = sessions?.race || sessions?.qualifying || {};
    const race = {
      round: Number(round),
      raceName,
      date: metadata.dateStart ? String(metadata.dateStart).slice(0, 10) : calendarEntry.date || null,
      Circuit: { circuitName: calendarEntry.circuit || calendarEntry.circuitName || null },
      Results: apiRowsForSession(sessions?.race)
    };
    if (race.Results.length) results.push(race);
    const qualifyingRows = apiRowsForSession(sessions?.qualifying);
    if (qualifyingRows.length) qualifying.push({ round: Number(round), QualifyingResults: qualifyingRows });
    const sprintRows = apiRowsForSession(sessions?.sprint);
    if (sprintRows.length) sprints.push({ round: Number(round), SprintResults: sprintRows });
  }
  return {
    results: results.sort((a, b) => a.round - b.round),
    qualifying: qualifying.sort((a, b) => a.round - b.round),
    sprints: sprints.sort((a, b) => a.round - b.round)
  };
}

async function createRequester({
  baseUrl = DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  userAgent = "f1-predictions-openf1-provider"
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("OpenF1 provider requires fetch.");
  const normalizedBase = normalizeBaseUrl(baseUrl);
  let lastRequestAt = 0;
  let requestQueue = Promise.resolve();
  return function request(path, params = {}) {
    const run = requestQueue.then(async () => {
      const url = buildSourceUrl(normalizedBase, path, params);
      let lastError = null;
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        const waitMs = Math.max(0, Number(minIntervalMs) - (Date.now() - lastRequestAt));
        if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          lastRequestAt = Date.now();
          const response = await fetchImpl(url, {
            headers: { "user-agent": userAgent, accept: "application/json" },
            signal: controller.signal
          });
          if (response.ok) return { payload: await response.json(), url };
          const error = new Error("OpenF1 returned " + response.status + " for " + url);
          if (![408, 425, 429, 500, 502, 503, 504].includes(response.status) || attempt >= retries) throw error;
          lastError = error;
          const retryAfterSeconds = Number(response.headers?.get?.("retry-after") || 0);
          const retryWait = Math.min(MAX_RETRY_AFTER_MS, Math.max(
            Number(minIntervalMs),
            retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 250 * (attempt + 1)
          ));
          await new Promise((resolve) => setTimeout(resolve, retryWait));
        } catch (error) {
          lastError = error.name === "AbortError" ? new Error("OpenF1 timed out for " + url) : error;
          if (attempt >= retries) throw lastError;
        } finally {
          clearTimeout(timeout);
        }
        if (lastError && attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
      throw lastError || new Error("OpenF1 request failed.");
    });
    requestQueue = run.catch(() => {});
    return run;
  };
}

async function fetchOpenF1SeasonData({
  season,
  calendar = [],
  baseUrl = process.env.OPENF1_API_BASE_URL || DEFAULT_BASE_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retries = DEFAULT_RETRIES,
  maxRound = null
} = {}) {
  const safeSeason = Number(season);
  if (!Number.isInteger(safeSeason) || safeSeason <= 0) throw new Error("OpenF1 season must be a positive integer.");
  const request = await createRequester({ baseUrl, fetchImpl, timeoutMs, retries });
  const meetingsResponse = await request("meetings", { year: safeSeason });
  const sessionsResponse = await request("sessions", { year: safeSeason });
  const meetings = unwrapArray(meetingsResponse.payload, "meetings");
  const sessions = unwrapArray(sessionsResponse.payload, "sessions");
  const sessionsByMeeting = new Map();
  sessions.forEach((session) => {
    const key = String(session.meeting_key);
    if (!sessionsByMeeting.has(key)) sessionsByMeeting.set(key, []);
    sessionsByMeeting.get(key).push(session);
  });
  const sessionsByRound = new Map();
  const sourceUrlsByRound = new Map();
  const sourceIdentityByRound = new Map();
  const payloadRevisionByRound = new Map();
  const completedRounds = [];
  for (const meeting of meetings) {
    if (meeting?.is_cancelled) continue;
    const round = resolveMeetingRound(meeting, calendar);
    if (!Number.isFinite(round) || (maxRound != null && round > Number(maxRound))) continue;
    const roundSessions = {};
    const sourceUrls = {};
    for (const session of sessionsByMeeting.get(String(meeting.meeting_key)) || []) {
      const key = classifySession(session);
      if (!key || !SESSION_KEYS.includes(key)) continue;
      const sessionMeta = {
        sessionKey: String(session.session_key),
        meetingKey: String(session.meeting_key),
        sessionName: String(session.session_name || ""),
        sessionType: String(session.session_type || ""),
        dateStart: session.date_start || null,
        dateEnd: session.date_end || null,
        available: false,
        status: "unavailable",
        unavailableReason: null,
        rows: [],
        error: null,
        sourceUrl: null
      };
      try {
        const [driversResponse, resultsResponse] = await Promise.all([
          request("drivers", { session_key: session.session_key }),
          request("session_result", { session_key: session.session_key })
        ]);
        const drivers = unwrapArray(driversResponse.payload, "drivers for " + session.session_key);
        const results = unwrapArray(resultsResponse.payload, "results for " + session.session_key);
        const driversByNumber = new Map(drivers.map((driver) => [String(driver.driver_number), driver]));
        sessionMeta.rows = results.map((row) => normalizeOpenF1Row(
          row,
          driversByNumber.get(String(row.driver_number)) || null,
          key,
          { sessionKey: session.session_key, meetingKey: session.meeting_key }
        ));
        sessionMeta.available = sessionMeta.rows.length > 0;
        sessionMeta.status = sessionMeta.available ? "available" : "unavailable";
        sessionMeta.unavailableReason = sessionMeta.available ? null : "Provider returned no session rows";
        sourceUrls[key] = resultsResponse.url;
        sessionMeta.sourceUrl = resultsResponse.url;
        if (key === "race") {
          try {
            const gridResponse = await request("starting_grid", { session_key: session.session_key });
            const gridRows = unwrapArray(gridResponse.payload, "starting grid for " + session.session_key);
            const gridByNumber = new Map(gridRows.map((row) => [String(row.driver_number), normalizeGridPosition(row.position)]));
            sessionMeta.rows.forEach((row) => {
              row.grid = gridByNumber.get(String(row.number)) ?? null;
            });
            sourceUrls.startingGrid = gridResponse.url;
            sessionMeta.startingGridSourceUrl = gridResponse.url;
          } catch (error) {
            sessionMeta.error = "Starting grid unavailable: " + String(error?.message || error);
            sessionMeta.unavailableReason = sessionMeta.error;
          }
        }
      } catch (error) {
        sessionMeta.error = String(error?.message || error);
        sessionMeta.unavailableReason = sessionMeta.error;
      }
      roundSessions[key] = sessionMeta;
    }
    const isSprintWeekend = Boolean(roundSessions.sprint || roundSessions.sprintQualifying);
    const expectedKeys = isSprintWeekend
      ? ["practice1", "sprintQualifying", "sprint", "qualifying", "startingGrid", "race"]
      : ["practice1", "practice2", "practice3", "qualifying", "startingGrid", "race"];
    expectedKeys.forEach((key) => {
      if (roundSessions[key]) return;
      roundSessions[key] = {
        sessionKey: null,
        meetingKey: String(meeting.meeting_key),
        sessionName: key,
        sessionType: null,
        dateStart: null,
        dateEnd: null,
        available: false,
        status: "unavailable",
        unavailableReason: "Session was not published by OpenF1",
        rows: [],
        error: null,
        sourceUrl: null
      };
    });
    const raceSession = roundSessions.race;
    if (raceSession && !roundSessions.startingGrid?.available && raceSession.available) {
      const gridRows = raceSession.rows.filter((row) => row.grid != null);
      roundSessions.startingGrid = {
        ...roundSessions.startingGrid,
        sessionKey: raceSession.sessionKey,
        sessionName: "Starting Grid",
        sessionType: "starting_grid",
        dateStart: raceSession.dateStart,
        dateEnd: raceSession.dateEnd,
        available: gridRows.length > 0,
        status: gridRows.length > 0 ? "available" : "unavailable",
        unavailableReason: gridRows.length > 0 ? null : "Starting grid had no positions",
        rows: gridRows,
        sourceUrl: sourceUrls.startingGrid || raceSession.sourceUrl || null
      };
    }
    if (roundSessions.race?.available) completedRounds.push(round);
    sessionsByRound.set(round, roundSessions);
    sourceUrlsByRound.set(round, sourceUrls);
    sourceIdentityByRound.set(
      round,
      PROVIDER + ":" + safeSeason + ":meeting-" + meeting.meeting_key
    );
    payloadRevisionByRound.set(
      round,
      crypto.createHash("sha256").update(JSON.stringify(roundSessions)).digest("hex")
    );
  }
  const tables = buildOpenF1RaceTables({ sessionsByRound, calendar });
  return {
    season: safeSeason,
    provider: PROVIDER,
    providerSchema: PROVIDER_SCHEMA,
    sourceType: PROVIDER,
    sourceNote: "OpenF1 historical session evidence provider",
    sessionsByRound,
    sourceUrlsByRound,
    sourceIdentityByRound,
    payloadRevisionByRound,
    ...tables,
    completedRounds: Array.from(new Set(completedRounds)).sort((a, b) => a - b)
  };
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_RETRIES,
  DEFAULT_MIN_INTERVAL_MS,
  DEFAULT_TIMEOUT_MS,
  PROVIDER,
  PROVIDER_SCHEMA,
  SESSION_KEYS,
  buildOpenF1RaceTables,
  classifySession,
  createRequester,
  fetchOpenF1SeasonData,
  normalizeBaseUrl,
  normalizeGridPosition,
  normalizeOpenF1Row,
  resolveMeetingRound,
  statusFor
};
