"use strict";

const crypto = require("crypto");
const {
  listSeasonInputs,
  listSeasonMappings,
  normalizeEntityKey
} = require("./season-inputs");
const { buildCanonicalCatalog } = require("./canonical-answers");

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

function buildCatalogRevision(value) {
  const payload = JSON.stringify(stableValue(value));
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function labelFor(row) {
  return String(row?.display_name_override || row?.display_name || row?.label || "").trim();
}

function duplicateKeys(rows) {
  const seen = new Map();
  for (const row of rows || []) {
    const key = normalizeEntityKey(labelFor(row));
    if (!key) continue;
    const values = seen.get(key) || [];
    values.push(Number(row.id));
    seen.set(key, values);
  }
  return Array.from(seen.entries())
    .filter((entry) => new Set(entry[1]).size > 1)
    .map((entry) => ({ key: entry[0], ids: Array.from(new Set(entry[1])) }));
}

function buildReadiness(catalog, mappings, questions = []) {
  const blocking = [];
  const warnings = [];
  const checks = {};
  if (!catalog?.season) {
    blocking.push("season_missing");
    return { status: "blocked", ok: false, blocking, warnings, checks };
  }

  const duplicateLabels = {
    drivers: duplicateKeys(catalog.drivers),
    teams: duplicateKeys(catalog.teams),
    races: duplicateKeys(catalog.races)
  };
  checks.duplicateLabels = duplicateLabels;
  if (Object.values(duplicateLabels).some((rows) => rows.length > 0)) blocking.push("duplicate_labels");

  const rounds = (catalog.races || []).map((race) => Number(race.round_number)).filter(Number.isInteger);
  const expectedRounds = rounds.length ? Array.from({ length: Math.max(...rounds) }, (_, index) => index + 1) : [];
  const missingRounds = expectedRounds.filter((round) => !rounds.includes(round));
  checks.calendar = { raceCount: rounds.length, missingRounds };
  if (missingRounds.length) blocking.push("calendar_gaps");

  const driverIds = new Set((catalog.drivers || []).map((driver) => Number(driver.id)));
  const teamIds = new Set((catalog.teams || []).map((team) => Number(team.id)));
  const maxRound = rounds.length ? Math.max(...rounds) : null;
  const invalidAssignments = (catalog.assignments || []).filter((assignment) => {
    const fromRound = Number(assignment.from_round);
    const toRound = assignment.to_round == null ? null : Number(assignment.to_round);
    return !driverIds.has(Number(assignment.driver_id))
      || !teamIds.has(Number(assignment.team_id))
      || !Number.isInteger(fromRound)
      || (toRound != null && (!Number.isInteger(toRound) || toRound < fromRound))
      || (maxRound != null && (fromRound < 1 || (toRound != null && toRound > maxRound)))
      || (maxRound != null && fromRound > maxRound);
  });
  checks.assignments = { count: (catalog.assignments || []).length, invalid: invalidAssignments.map((row) => Number(row.id)) };
  if (invalidAssignments.length) blocking.push("invalid_assignments");

  const unresolvedMappings = (mappings || []).filter((mapping) => mapping.status !== "resolved");
  checks.mappings = { count: (mappings || []).length, unresolved: unresolvedMappings.length };
  if (unresolvedMappings.length) {
    warnings.push("unresolved_mappings");
    if (unresolvedMappings.some((mapping) => mapping.status === "ambiguous")) blocking.push("ambiguous_mappings");
  }

  const questionChecks = (questions || [])
    .filter((question) => question && question.options_source)
    .map((question) => {
      const group = { drivers: "driver", teams: "team", races: "race" }[question.options_source];
      const count = group ? (catalog.canonical?.[group] || []).length : 0;
      return { id: question.id || question.key || null, source: question.options_source, optionCount: count, ready: count > 0 };
    });
  checks.questions = questionChecks;
  if (questionChecks.some((check) => !check.ready)) warnings.push("question_options_missing");

  return {
    status: blocking.length ? "blocked" : "ready",
    ok: blocking.length === 0,
    blocking: Array.from(new Set(blocking)),
    warnings: Array.from(new Set(warnings)),
    checks
  };
}

function semanticCatalog(catalog, mappings) {
  return {
    season: catalog?.season ? { id: Number(catalog.season.id), year: Number(catalog.season.year), status: catalog.season.status } : null,
    drivers: (catalog?.drivers || []).map((row) => ({
      id: Number(row.id),
      label: labelFor(row),
      slug: String(row.slug || ""),
      driverNumber: row.driver_number == null ? null : String(row.driver_number)
    })),
    teams: (catalog?.teams || []).map((row) => ({
      id: Number(row.id),
      label: labelFor(row),
      slug: String(row.slug || ""),
      displayOrder: Number(row.display_order || 0)
    })),
    races: (catalog?.races || []).map((row) => ({
      id: Number(row.id),
      round: Number(row.round_number),
      label: labelFor(row),
      slug: String(row.slug || ""),
      scheduledDate: row.scheduled_date || null,
      status: row.derived_status || row.calendar_state || null
    })),
    assignments: (catalog?.assignments || []).map((row) => ({
      id: Number(row.id),
      driverId: Number(row.driver_id),
      teamId: Number(row.team_id),
      seat: Number(row.seat_number || 1),
      fromRound: Number(row.from_round),
      toRound: row.to_round == null ? null : Number(row.to_round)
    })),
    mappings: (mappings || []).map((row) => ({
      id: Number(row.id),
      type: row.mappingType,
      entityType: row.entityType,
      entityId: Number(row.entityId),
      sourceKey: row.sourceKey,
      status: row.status
    }))
  };
}

function buildSeasonCatalog(db, year, { questions = [] } = {}) {
  const inputs = listSeasonInputs(db, year);
  const mappings = listSeasonMappings(db, year);
  const canonical = buildCanonicalCatalog(inputs);
  const withCanonical = { ...inputs, canonical };
  const semantic = semanticCatalog(withCanonical, mappings);
  const revision = buildCatalogRevision(semantic);
  const readiness = buildReadiness({ ...withCanonical, canonical }, mappings, questions);
  return {
    ...withCanonical,
    mappings,
    semantic,
    revision,
    catalogRevision: revision,
    readiness
  };
}

module.exports = {
  buildCatalogRevision,
  buildReadiness,
  buildSeasonCatalog,
  duplicateKeys,
  semanticCatalog,
  stableValue
};
