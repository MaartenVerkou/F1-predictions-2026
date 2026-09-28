"use strict";

const DEFAULT_RACE_POINTS = Object.freeze({
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
  6: 8, 7: 6, 8: 4, 9: 2, 10: 1
});

const DEFAULT_SPRINT_POINTS = Object.freeze({
  1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1
});

const DEFAULT_SCORING_RULES = Object.freeze({
  revision: "fia-standard-2025",
  source: "FIA Formula One Sporting Regulations",
  racePoints: DEFAULT_RACE_POINTS,
  sprintPoints: DEFAULT_SPRINT_POINTS,
  fastestLap: Object.freeze({ points: 0, minimumFinish: 1, eligible: false }),
  constructorAggregation: "sum-driver-points"
});

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePointsTable(value, fallback = {}) {
  const source = value && typeof value === "object" ? value : fallback;
  return Object.fromEntries(
    Object.entries(source)
      .map(([position, points]) => [Number(position), numberOrNull(points)])
      .filter(([position, points]) => Number.isInteger(position) && position > 0 && points != null && points >= 0)
      .sort(([left], [right]) => left - right)
  );
}

function normalizeScoringRules(input = {}) {
  const fastestLapInput = input.fastestLap && typeof input.fastestLap === "object"
    ? input.fastestLap
    : {};
  return {
    revision: String(input.revision || DEFAULT_SCORING_RULES.revision).trim(),
    source: String(input.source || DEFAULT_SCORING_RULES.source).trim(),
    racePoints: normalizePointsTable(input.racePoints, DEFAULT_RACE_POINTS),
    sprintPoints: normalizePointsTable(input.sprintPoints, DEFAULT_SPRINT_POINTS),
    fastestLap: {
      points: Math.max(0, numberOrNull(fastestLapInput.points) ?? 0),
      minimumFinish: Math.max(1, numberOrNull(fastestLapInput.minimumFinish) ?? 1),
      eligible: fastestLapInput.eligible === true
    },
    constructorAggregation: String(
      input.constructorAggregation || DEFAULT_SCORING_RULES.constructorAggregation
    ).trim()
  };
}

function resultPosition(row) {
  const position = numberOrNull(row?.position);
  return Number.isInteger(position) && position > 0 ? position : null;
}

function statusIsClassified(row) {
  const status = String(row?.status || "").trim().toLowerCase();
  if (!status) return true;
  return !/^(dnf|ret|retired|dns|dnq|dsq|nc|not classified|did not start|did not qualify|withdrew|wd|accident|collision|crash|mechanical|engine|gearbox|hydraulic|brake|electrical|damage)/i.test(status);
}

function pointsForResult(row, sessionType, rulesInput = DEFAULT_SCORING_RULES) {
  const rules = normalizeScoringRules(rulesInput);
  const position = resultPosition(row);
  if (position == null || !statusIsClassified(row)) return 0;
  const table = String(sessionType || "race").toLowerCase() === "sprint"
    ? rules.sprintPoints
    : rules.racePoints;
  let points = Number(table[position] || 0);
  if (
    rules.fastestLap.eligible
    && rules.fastestLap.points > 0
    && position >= rules.fastestLap.minimumFinish
    && row?.fastestLap === true
  ) {
    points += rules.fastestLap.points;
  }
  return points;
}

function scoreResultRows(rows, sessionType, rulesInput = DEFAULT_SCORING_RULES) {
  const rules = normalizeScoringRules(rulesInput);
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    providerPoints: row?.providerPoints == null ? numberOrNull(row?.points) : numberOrNull(row.providerPoints),
    calculatedPoints: pointsForResult(row, sessionType, rules),
    points: pointsForResult(row, sessionType, rules)
  }));
}

function entityKey(row, entityType) {
  const id = entityType === "constructor"
    ? row?.team_id ?? row?.Constructor?.constructorId
    : row?.driver_id ?? row?.Driver?.driverId;
  const name = entityType === "constructor"
    ? row?.constructor || row?.Constructor?.name
    : row?.driver || [row?.Driver?.givenName, row?.Driver?.familyName].filter(Boolean).join(" ");
  return id != null ? `id:${id}` : `name:${String(name || "").trim()}`;
}

function entityName(row, entityType) {
  return String(entityType === "constructor"
    ? row?.constructor || row?.Constructor?.name
    : row?.driver || [row?.Driver?.givenName, row?.Driver?.familyName].filter(Boolean).join(" ") || "").trim();
}

function deriveStandingsForRounds(rounds, rulesInput = DEFAULT_SCORING_RULES) {
  const rules = normalizeScoringRules(rulesInput);
  const totals = { driver: new Map(), constructor: new Map() };
  const stats = { driver: new Map(), constructor: new Map() };
  const output = new Map();
  const ensureEntity = (entityType, row) => {
    const key = entityKey(row, entityType);
    if (!key || key.endsWith(":")) return null;
    if (!totals[entityType].has(key)) totals[entityType].set(key, {
      entity: entityName(row, entityType),
      entity_id: entityType === "constructor"
        ? row?.team_id ?? row?.Constructor?.constructorId ?? null
        : row?.driver_id ?? row?.Driver?.driverId ?? null,
      points: 0
    });
    if (!stats[entityType].has(key)) stats[entityType].set(key, { wins: 0, podiums: 0, bestFinish: null });
    return key;
  };
  const applyRows = (rows, sessionType) => {
    scoreResultRows(rows, sessionType, rules).forEach((row) => {
      ["driver", "constructor"].forEach((entityType) => {
        const key = ensureEntity(entityType, row);
        if (!key) return;
        const points = Number(row.calculatedPoints || 0);
        totals[entityType].get(key).points += points;
        const position = resultPosition(row);
        if (sessionType === "race" && position != null) {
          const entityStats = stats[entityType].get(key);
          entityStats.bestFinish = entityStats.bestFinish == null
            ? position
            : Math.min(entityStats.bestFinish, position);
        }
        if (entityType === "driver" && sessionType === "race") {
          if (position === 1) stats[entityType].get(key).wins += 1;
          if (position != null && position <= 3) stats[entityType].get(key).podiums += 1;
        }
        if (entityType === "constructor" && sessionType === "race" && position != null && position <= 3) {
          stats[entityType].get(key).podiums += 1;
          if (position === 1) stats[entityType].get(key).wins += 1;
        }
      });
    });
  };
  const rank = (entityType) => Array.from(totals[entityType].entries())
    .map(([key, value]) => ({ ...value, ...stats[entityType].get(key) }))
    .sort((left, right) => (
      right.points - left.points
      || right.wins - left.wins
      || right.podiums - left.podiums
      || (left.bestFinish ?? Number.MAX_SAFE_INTEGER) - (right.bestFinish ?? Number.MAX_SAFE_INTEGER)
      || left.entity.localeCompare(right.entity)
    ))
    .map((row, index) => ({
      entity: row.entity,
      entity_label: row.entity,
      entity_id: row.entity_id,
      position: index + 1,
      points: row.points,
      wins: row.wins,
      podiums: row.podiums,
      bestFinish: row.bestFinish
    }));
  (rounds || [])
    .slice()
    .sort((left, right) => Number(left.roundNumber || left.round || 0) - Number(right.roundNumber || right.round || 0))
    .forEach((round) => {
      applyRows(round?.race?.rows || round?.raceRows || [], "race");
      applyRows(round?.sprint?.rows || round?.sprintRows || [], "sprint");
      const roundNumber = Number(round.roundNumber || round.round || 0);
      output.set(roundNumber, { drivers: rank("driver"), constructors: rank("constructor") });
    });
  return output;
}

function reconcileStandings(legacyRows, derivedRows) {
  const keyFor = (row) => String(row?.entity_id != null ? `id:${row.entity_id}` : `name:${row?.entity || ""}`);
  const legacy = new Map((legacyRows || []).map((row) => [keyFor(row), row]));
  const derived = new Map((derivedRows || []).map((row) => [keyFor(row), row]));
  const keys = new Set([...legacy.keys(), ...derived.keys()]);
  return Array.from(keys).map((key) => {
    const oldRow = legacy.get(key) || null;
    const newRow = derived.get(key) || null;
    const oldPoints = oldRow?.points == null ? null : Number(oldRow.points);
    const newPoints = newRow?.points == null ? null : Number(newRow.points);
    return {
      key,
      entity: newRow?.entity || oldRow?.entity || null,
      legacyPoints: oldPoints,
      derivedPoints: newPoints,
      status: oldRow == null || newRow == null ? "missing" : oldPoints === newPoints ? "match" : "difference"
    };
  });
}

function scoringRulesTableValue(rules) {
  const normalized = normalizeScoringRules(rules);
  return {
    revision: normalized.revision,
    source: normalized.source,
    racePoints: normalized.racePoints,
    sprintPoints: normalized.sprintPoints,
    fastestLap: normalized.fastestLap,
    constructorAggregation: normalized.constructorAggregation
  };
}

function idDefinition(db) {
  return db.dialect === "postgres"
    ? "INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY"
    : "INTEGER PRIMARY KEY AUTOINCREMENT";
}

function ensureSeasonScoringRulesSchema(db) {
  const identity = idDefinition(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS season_scoring_rules (
      id ${identity},
      season_id INTEGER NOT NULL,
      revision TEXT NOT NULL,
      source TEXT NOT NULL,
      race_points_json TEXT NOT NULL,
      sprint_points_json TEXT NOT NULL,
      fastest_lap_json TEXT NOT NULL,
      constructor_aggregation TEXT NOT NULL,
      effective_from_round INTEGER NOT NULL DEFAULT 1,
      effective_to_round INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(season_id, effective_from_round)
    );
    CREATE INDEX IF NOT EXISTS idx_season_scoring_rules_lookup
      ON season_scoring_rules(season_id, effective_from_round, effective_to_round);
  `);
}

function seedSeasonScoringRules(db, { seasonId, rules = DEFAULT_SCORING_RULES, now = new Date().toISOString() } = {}) {
  const safeSeasonId = Number(seasonId);
  if (!Number.isInteger(safeSeasonId) || safeSeasonId <= 0) throw new Error("A valid season id is required for scoring rules.");
  const normalized = normalizeScoringRules(rules);
  const result = db.prepare(`
    INSERT INTO season_scoring_rules (
      season_id, revision, source, race_points_json, sprint_points_json, fastest_lap_json,
      constructor_aggregation, effective_from_round, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(season_id, effective_from_round) DO NOTHING
  `).run(
    safeSeasonId,
    normalized.revision,
    normalized.source,
    JSON.stringify(normalized.racePoints),
    JSON.stringify(normalized.sprintPoints),
    JSON.stringify(normalized.fastestLap),
    normalized.constructorAggregation,
    now,
    now
  );
  return Number(result?.changes || 0);
}

function readSeasonScoringRules(db, seasonId, round = null) {
  const safeSeasonId = Number(seasonId);
  if (!Number.isInteger(safeSeasonId) || safeSeasonId <= 0) return null;
  const safeRound = Number(round);
  const effectiveRound = Number.isInteger(safeRound) && safeRound > 0 ? safeRound : 2147483647;
  const row = db.prepare(`
    SELECT revision, source, race_points_json, sprint_points_json, fastest_lap_json,
      constructor_aggregation, effective_from_round, effective_to_round
    FROM season_scoring_rules
    WHERE season_id = ?
      AND effective_from_round <= ?
      AND (effective_to_round IS NULL OR effective_to_round >= ?)
    ORDER BY effective_from_round DESC
    LIMIT 1
  `).get(safeSeasonId, effectiveRound, effectiveRound);
  if (!row) return null;
  return normalizeScoringRules({
    revision: row.revision,
    source: row.source,
    racePoints: JSON.parse(row.race_points_json),
    sprintPoints: JSON.parse(row.sprint_points_json),
    fastestLap: JSON.parse(row.fastest_lap_json),
    constructorAggregation: row.constructor_aggregation
  });
}

module.exports = {
  DEFAULT_SCORING_RULES,
  DEFAULT_RACE_POINTS,
  DEFAULT_SPRINT_POINTS,
  deriveStandingsForRounds,
  normalizeScoringRules,
  pointsForResult,
  reconcileStandings,
  scoreResultRows,
  scoringRulesTableValue,
  ensureSeasonScoringRulesSchema,
  seedSeasonScoringRules,
  readSeasonScoringRules
};
