"use strict";

const {
  DEFAULT_SCORING_RULES,
  deriveStandingsForRounds,
  reconcileStandings,
  scoreResultRows
} = require("./season-scoring-rules");

function canonicalDriverParts(name) {
  const parts = String(name || "").trim().split(/\s+/);
  return {
    givenName: parts.shift() || "",
    familyName: parts.join(" ")
  };
}

function buildApiRowFromEvidence(row) {
  return {
    position: row.position == null ? (row.positionText || "") : String(row.position),
    grid: row.grid == null ? "" : String(row.grid),
    points: row.calculatedPoints == null
      ? (row.points == null ? "0" : String(row.points))
      : String(row.calculatedPoints),
    status: row.status || "",
    laps: row.laps == null ? "" : String(row.laps),
    Driver: canonicalDriverParts(row.driver),
    Constructor: { name: row.constructor || "" }
  };
}

function rowsFromSession(payload, sessionKey, fallbackSection) {
  const sessions = payload?.sessions;
  const canonicalRows = Array.isArray(sessions?.[sessionKey]?.rows)
    ? sessions[sessionKey].rows
    : [];
  if (canonicalRows.length) return canonicalRows;
  return Array.isArray(fallbackSection?.rows) ? fallbackSection.rows : [];
}

function sessionMetaFromPayload(payload, sessionKey, fallbackSection) {
  const session = payload?.sessions?.[sessionKey];
  if (session && typeof session === "object") {
    return {
      ...session,
      rows: rowsFromSession(payload, sessionKey, fallbackSection)
    };
  }
  return {
    available: Array.isArray(fallbackSection?.rows) && fallbackSection.rows.length > 0,
    status: fallbackSection?.rows?.length ? "available" : "unavailable",
    unavailableReason: fallbackSection?.rows?.length ? null : "No persisted rows",
    rows: rowsFromSession(payload, sessionKey, fallbackSection)
  };
}

function buildPersistedDataFromEvidence(evidenceRows, season, { scoringRules = DEFAULT_SCORING_RULES } = {}) {
  const results = [];
  const qualifying = [];
  const sprints = [];
  const driverOfTheDayByRound = new Map();
  const destructorsByRound = new Map();
  const destructorsErrorsByRound = new Map();
  const sessionsByRound = new Map();
  const legacyDriverStandingsByRound = new Map();
  const legacyConstructorStandingsByRound = new Map();
  const roundsForStandings = [];

  for (const row of evidenceRows || []) {
    const payload = row.payload || {};
    const round = Number(row.round_number);
    if (!Number.isFinite(round)) continue;
    const raceEvidenceRows = scoreResultRows(
      rowsFromSession(payload, "race", payload.race),
      "race",
      scoringRules
    );
    const qualifyingEvidenceRows = rowsFromSession(payload, "qualifying", payload.qualifying);
    const sprintEvidenceRows = scoreResultRows(
      rowsFromSession(payload, "sprint", payload.sprint),
      "sprint",
      scoringRules
    );
    const canonicalSessions = {};
    [
      "practice1",
      "practice2",
      "practice3",
      "sprintQualifying",
      "sprint",
      "qualifying",
      "startingGrid",
      "race"
    ].forEach((sessionKey) => {
      canonicalSessions[sessionKey] = sessionMetaFromPayload(
        payload,
        sessionKey,
        payload[sessionKey] || (sessionKey === "race" ? payload.race : null)
      );
    });
    canonicalSessions.race = { ...(canonicalSessions.race || {}), rows: raceEvidenceRows };
    canonicalSessions.sprint = { ...(canonicalSessions.sprint || {}), rows: sprintEvidenceRows };
    sessionsByRound.set(round, canonicalSessions);
    roundsForStandings.push({ roundNumber: round, raceRows: raceEvidenceRows, sprintRows: sprintEvidenceRows });
    const raceRows = raceEvidenceRows.map(buildApiRowFromEvidence);
    results.push({
      round,
      raceName: payload.roundName || row.round_name || ("Round " + round),
      date: payload.race?.date || null,
      Circuit: { circuitName: payload.race?.circuit || null },
      Results: raceRows
    });
    const qualifyingRows = qualifyingEvidenceRows.map(buildApiRowFromEvidence);
    if (qualifyingRows.length) qualifying.push({
      round,
      QualifyingResults: qualifyingRows
    });
    const sprintRows = sprintEvidenceRows.map(buildApiRowFromEvidence);
    if (sprintRows.length) sprints.push({
      round,
      SprintResults: sprintRows
    });
    legacyDriverStandingsByRound.set(round, (payload.standings?.drivers || []).map((item) => ({
      position: item.position == null ? "" : String(item.position),
      points: item.points == null ? "0" : String(item.points),
      Driver: canonicalDriverParts(item.entity)
    })));
    legacyConstructorStandingsByRound.set(round, (payload.standings?.constructors || []).map((item) => ({
      position: item.position == null ? "" : String(item.position),
      points: item.points == null ? "0" : String(item.points),
      Constructor: { name: item.entity }
    })));
    if (payload.external?.driverOfTheDay) {
      driverOfTheDayByRound.set(round, payload.external.driverOfTheDay);
    }
    const damage = payload.external?.damage;
    const damageRows = Array.isArray(damage?.rows) ? damage.rows.map((item) => ({
      round: item.round == null ? round : Number(item.round),
      driverName: item.driver || item.driver_label || null,
      constructorName: item.constructor || item.team_label || null,
      driverId: item.driver_id == null ? null : item.driver_id,
      constructorId: item.team_id == null ? null : item.team_id,
      driverCode: item.driver_code || null,
      components: Array.isArray(item.components) ? item.components.map((component) => ({
        componentId: component.component_id || component.componentId || null,
        name: component.name || "Unknown component",
        price: component.price,
        quantity: component.quantity,
        totalCost: component.total_cost == null ? component.totalCost : component.total_cost
      })) : [],
      totalCost: item.totalCost == null ? item.total_cost : item.totalCost,
      costStatus: item.cost_status || null,
      sourceText: item.source_text || item.sourceText || null,
      resolution: item.resolution || null
    })) : [];
    destructorsByRound.set(round, damageRows);
    if (damage?.error) destructorsErrorsByRound.set(round, String(damage.error));
  }

  const derivedStandingsByRound = deriveStandingsForRounds(roundsForStandings, scoringRules);
  const driverStandingsByRound = new Map();
  const constructorStandingsByRound = new Map();
  const reconciliationByRound = new Map();
  derivedStandingsByRound.forEach((standings, round) => {
    driverStandingsByRound.set(round, standings.drivers.map((item) => ({
      ...item,
      position: String(item.position),
      points: String(item.points),
      Driver: canonicalDriverParts(item.entity)
    })));
    constructorStandingsByRound.set(round, standings.constructors.map((item) => ({
      ...item,
      position: String(item.position),
      points: String(item.points),
      Constructor: { name: item.entity }
    })));
    reconciliationByRound.set(round, {
      drivers: reconcileStandings(legacyDriverStandingsByRound.get(round), standings.drivers),
      constructors: reconcileStandings(legacyConstructorStandingsByRound.get(round), standings.constructors)
    });
  });

  return {
    season: Number(season),
    results: results.sort((a, b) => a.round - b.round),
    qualifying: qualifying.sort((a, b) => a.round - b.round),
    sprints: sprints.sort((a, b) => a.round - b.round),
    completedRounds: results.map((row) => row.round),
    driverStandingsByRound,
    constructorStandingsByRound,
    derivedStandingsByRound,
    legacyDriverStandingsByRound,
    legacyConstructorStandingsByRound,
    reconciliationByRound,
    driverOfTheDayByRound,
    destructorsByRound,
    destructorsErrorsByRound,
    sessionsByRound
  };
}

module.exports = {
  buildApiRowFromEvidence,
  buildPersistedDataFromEvidence,
  canonicalDriverParts,
  rowsFromSession
};
