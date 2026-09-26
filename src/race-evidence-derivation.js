"use strict";

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
    points: row.points == null ? "0" : String(row.points),
    status: row.status || "",
    laps: row.laps == null ? "" : String(row.laps),
    Driver: canonicalDriverParts(row.driver),
    Constructor: { name: row.constructor || "" }
  };
}

function buildPersistedDataFromEvidence(evidenceRows, season) {
  const results = [];
  const qualifying = [];
  const sprints = [];
  const driverStandingsByRound = new Map();
  const constructorStandingsByRound = new Map();
  const driverOfTheDayByRound = new Map();
  const destructorsByRound = new Map();
  const destructorsErrorsByRound = new Map();

  for (const row of evidenceRows || []) {
    const payload = row.payload || {};
    const round = Number(row.round_number);
    if (!Number.isFinite(round)) continue;
    const raceRows = (payload.race?.rows || []).map(buildApiRowFromEvidence);
    results.push({
      round,
      raceName: payload.roundName || row.round_name || ("Round " + round),
      date: payload.race?.date || null,
      Circuit: { circuitName: payload.race?.circuit || null },
      Results: raceRows
    });
    const qualifyingRows = (payload.qualifying?.rows || []).map(buildApiRowFromEvidence);
    if (qualifyingRows.length) qualifying.push({
      round,
      QualifyingResults: qualifyingRows
    });
    const sprintRows = (payload.sprint?.rows || []).map(buildApiRowFromEvidence);
    if (sprintRows.length) sprints.push({
      round,
      SprintResults: sprintRows
    });
    driverStandingsByRound.set(round, (payload.standings?.drivers || []).map((item) => ({
      position: item.position == null ? "" : String(item.position),
      points: item.points == null ? "0" : String(item.points),
      Driver: canonicalDriverParts(item.entity)
    })));
    constructorStandingsByRound.set(round, (payload.standings?.constructors || []).map((item) => ({
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

  return {
    season: Number(season),
    results: results.sort((a, b) => a.round - b.round),
    qualifying: qualifying.sort((a, b) => a.round - b.round),
    sprints: sprints.sort((a, b) => a.round - b.round),
    completedRounds: results.map((row) => row.round),
    driverStandingsByRound,
    constructorStandingsByRound,
    driverOfTheDayByRound,
    destructorsByRound,
    destructorsErrorsByRound
  };
}

module.exports = {
  buildApiRowFromEvidence,
  buildPersistedDataFromEvidence,
  canonicalDriverParts
};
