"use strict";

const DRIVER_NAME_ALIASES = {
  andreakimiantonelli: "Kimi Antonelli",
  carlossainz: "Carlos Sainz Jr.",
  carlossainzjr: "Carlos Sainz Jr.",
  nicohulkenberg: "Nico Hulkenberg",
  nicohuelkenberg: "Nico Hulkenberg"
};

const TEAM_NAME_ALIASES = {
  redbull: "Red Bull Racing",
  redbullracing: "Red Bull Racing",
  rbf1team: "Racing Bulls",
  racingbulls: "Racing Bulls",
  cadillacf1team: "Cadillac",
  alpinef1team: "Alpine",
  astonmartinf1team: "Aston Martin"
};

const SOURCE_TYPES = {
  JOLPICA: "jolpica_ergast",
  FORMULA1: "formula1"
};

function parseNum(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLookupKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function resolveCanonicalName(raw, allowedValues, aliasMap = {}) {
  const key = normalizeLookupKey(raw);
  if (!key) return null;
  const aliased = aliasMap[key];
  if (aliased && (allowedValues || []).includes(aliased)) return aliased;
  return (allowedValues || []).find((value) => normalizeLookupKey(value) === key) || null;
}

function driverNameFromApi(driver, rosterDrivers = []) {
  if (!driver) return null;
  const raw = `${driver.givenName || ""} ${driver.familyName || ""}`.trim();
  return resolveCanonicalName(raw, rosterDrivers, DRIVER_NAME_ALIASES) || raw || null;
}

function teamNameFromApi(constructor, rosterTeams = []) {
  if (!constructor) return null;
  return (
    resolveCanonicalName(constructor.name, rosterTeams, TEAM_NAME_ALIASES) ||
    String(constructor.name || "").trim() ||
    null
  );
}

function normalizeResultRow(row, roster, kind) {
  const driver = driverNameFromApi(row?.Driver, roster?.drivers || []);
  const constructor = teamNameFromApi(row?.Constructor, roster?.teams || []);
  if (!driver && !constructor) return null;
  const positionRaw = String(row?.position || "").trim();
  const position = parseNum(positionRaw);
  return {
    driver,
    constructor,
    number: String(row?.number || "").trim() || null,
    grid: parseNum(row?.grid),
    position,
    positionText: position != null ? String(position) : positionRaw || null,
    status: String(row?.status || "").trim() || null,
    points: parseNum(row?.points, 0),
    laps: parseNum(row?.laps),
    fastestLap: String(row?.FastestLap?.rank || "").trim() === "1",
    pole: kind === "qualifying" && position === 1
  };
}

function normalizeStandingsRow(row, roster, entityType) {
  const entity =
    entityType === "driver"
      ? driverNameFromApi(row?.Driver, roster?.drivers || [])
      : teamNameFromApi(row?.Constructor, roster?.teams || []);
  if (!entity) return null;
  return {
    entity,
    position: parseNum(row?.position),
    points: parseNum(row?.points, 0)
  };
}

function normalizeSourceRows(rows, roster, kind) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeResultRow(row, roster, kind))
    .filter(Boolean);
}

function normalizeCoverage({ race, qualifying, sprint, driverStandings, constructorStandings }) {
  const coverage = {
    race: { available: race.length > 0, count: race.length },
    qualifying: { available: qualifying.length > 0, count: qualifying.length },
    sprint: { available: sprint.length > 0, count: sprint.length },
    driverStandings: { available: driverStandings.length > 0, count: driverStandings.length },
    constructorStandings: {
      available: constructorStandings.length > 0,
      count: constructorStandings.length
    }
  };
  const requiredAvailable = coverage.race.available &&
    coverage.driverStandings.available &&
    coverage.constructorStandings.available;
  return {
    status: requiredAvailable ? "complete" : "incomplete",
    sources: coverage
  };
}

function buildEvidenceBundle({ data, roster, roundNumber, roundName, fetchedAt, sourceUrls = {} }) {
  const round = Number(roundNumber);
  const race = (data?.results || []).find((item) => Number(item?.round) === round) || {};
  const qualifyingRace =
    (data?.qualifying || []).find((item) => Number(item?.round) === round) || {};
  const sprintRace =
    (data?.sprints || []).find((item) => Number(item?.round) === round) || {};
  const driverStandings = data?.driverStandingsByRound?.get(round) || [];
  const constructorStandings = data?.constructorStandingsByRound?.get(round) || [];
  const raceRows = normalizeSourceRows(race.Results, roster, "race");
  const qualifyingRows = normalizeSourceRows(
    qualifyingRace.QualifyingResults,
    roster,
    "qualifying"
  );
  const sprintRows = normalizeSourceRows(sprintRace.SprintResults, roster, "sprint");
  const normalizedDriverStandings = driverStandings
    .map((row) => normalizeStandingsRow(row, roster, "driver"))
    .filter(Boolean);
  const normalizedConstructorStandings = constructorStandings
    .map((row) => normalizeStandingsRow(row, roster, "constructor"))
    .filter(Boolean);
  const coverage = normalizeCoverage({
    race: raceRows,
    qualifying: qualifyingRows,
    sprint: sprintRows,
    driverStandings: normalizedDriverStandings,
    constructorStandings: normalizedConstructorStandings
  });
  return {
    schemaVersion: 1,
    season: parseNum(data?.season, null),
    roundNumber: round,
    roundName: String(roundName || race?.raceName || `Round ${round}`).trim(),
    fetchedAt: fetchedAt || new Date().toISOString(),
    sourceUrls: {
      race: sourceUrls.race || null,
      qualifying: sourceUrls.qualifying || null,
      sprint: sourceUrls.sprint || null,
      driverStandings: sourceUrls.driverStandings || null,
      constructorStandings: sourceUrls.constructorStandings || null,
      driverOfTheDay: sourceUrls.driverOfTheDay || null
    },
    coverage,
    race: {
      date: race?.date || null,
      circuit: race?.Circuit?.circuitName || null,
      rows: raceRows
    },
    qualifying: { rows: qualifyingRows },
    sprint: { rows: sprintRows },
    standings: {
      drivers: normalizedDriverStandings,
      constructors: normalizedConstructorStandings
    },
    external: {
      driverOfTheDay: data?.driverOfTheDayByRound?.get(round) || null
    }
  };
}

function parseEvidencePayload(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch (err) {
    return null;
  }
}

function listColumnNames(db, tableName) {
  return new Set(
    db
      .prepare(`PRAGMA table_info(${tableName});`)
      .all()
      .map((column) => column.name)
  );
}

function ensureRaceDataSchema(db) {
  const actualColumns = listColumnNames(db, "actual_snapshots");
  if (!actualColumns.has("source_data_import_id")) {
    db.exec("ALTER TABLE actual_snapshots ADD COLUMN source_data_import_id INTEGER;");
  }
  if (!actualColumns.has("source_data_snapshot_id")) {
    db.exec("ALTER TABLE actual_snapshots ADD COLUMN source_data_snapshot_id INTEGER;");
  }

  const identity = db.dialect === "postgres"
    ? "id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY"
    : "id INTEGER PRIMARY KEY AUTOINCREMENT";
  db.exec(
    "CREATE TABLE IF NOT EXISTS race_data_imports (" + identity + ", " +
      "season INTEGER NOT NULL, sync_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL, " +
      "source_type TEXT NOT NULL, parser_version TEXT NOT NULL, started_at TEXT NOT NULL, " +
      "completed_at TEXT, requested_rounds INTEGER NOT NULL DEFAULT 0, " +
      "completed_rounds INTEGER NOT NULL DEFAULT 0, reconstructed INTEGER NOT NULL DEFAULT 0, " +
      "source_note TEXT, error_message TEXT); " +
    "CREATE INDEX IF NOT EXISTS idx_race_data_imports_season_started " +
      "ON race_data_imports(season, started_at); " +
    "CREATE TABLE IF NOT EXISTS race_data_snapshots (" + identity + ", " +
      "import_id INTEGER, season INTEGER NOT NULL, round_number INTEGER NOT NULL, " +
      "round_name TEXT, sync_id TEXT NOT NULL, fetched_at TEXT NOT NULL, " +
      "source_type TEXT NOT NULL, source_note TEXT, " +
      "parser_version TEXT NOT NULL DEFAULT 'evidence-v1', " +
      "calendar_state TEXT NOT NULL DEFAULT 'completed', " +
      "reconstructed INTEGER NOT NULL DEFAULT 0, coverage_status TEXT NOT NULL, " +
      "payload_json TEXT NOT NULL, created_at TEXT NOT NULL, " +
      "UNIQUE(season, round_number, sync_id)); " +
    "CREATE INDEX IF NOT EXISTS idx_race_data_snapshots_season_round " +
      "ON race_data_snapshots(season, round_number, created_at); " +
    "CREATE INDEX IF NOT EXISTS idx_race_data_snapshots_import " +
      "ON race_data_snapshots(import_id, round_number);"
  );

  const snapshotColumns = listColumnNames(db, "race_data_snapshots");
  const additions = [
    ["import_id", "INTEGER"],
    ["parser_version", "TEXT NOT NULL DEFAULT 'evidence-v1'"],
    ["calendar_state", "TEXT NOT NULL DEFAULT 'completed'"],
    ["reconstructed", "INTEGER NOT NULL DEFAULT 0"]
  ];
  for (const [name, type] of additions) {
    if (!snapshotColumns.has(name)) {
      db.exec("ALTER TABLE race_data_snapshots ADD COLUMN " + name + " " + type + ";");
    }
  }
  db.exec(
    "UPDATE race_data_snapshots SET parser_version = COALESCE(NULLIF(parser_version, ''), 'evidence-v1'), " +
      "calendar_state = COALESCE(NULLIF(calendar_state, ''), 'completed'), " +
      "reconstructed = COALESCE(reconstructed, 0) " +
      "WHERE parser_version IS NULL OR parser_version = '' OR calendar_state IS NULL OR " +
      "calendar_state = '' OR reconstructed IS NULL;"
  );
}

function createRaceDataImport(db, {
  season,
  syncId,
  sourceType = SOURCE_TYPES.JOLPICA,
  parserVersion = "evidence-v1",
  requestedRounds = 0,
  reconstructed = false,
  sourceNote = "",
  startedAt = new Date().toISOString()
}) {
  const existing = db.prepare("SELECT id FROM race_data_imports WHERE sync_id = ? LIMIT 1").get(String(syncId));
  if (existing) return Number(existing.id);
  const result = db.prepare(
    "INSERT INTO race_data_imports (" +
      "season, sync_id, status, source_type, parser_version, started_at, " +
      "requested_rounds, completed_rounds, reconstructed, source_note" +
      ") VALUES (?, ?, 'running', ?, ?, ?, ?, 0, ?, ?)"
  ).run(
    Number(season), String(syncId), sourceType, parserVersion, startedAt,
    Number(requestedRounds || 0), reconstructed ? 1 : 0,
    String(sourceNote || "").trim() || null
  );
  return Number(result.lastInsertRowid);
}

function completeRaceDataImport(db, importId, {
  status = "completed",
  completedRounds = 0,
  completedAt = new Date().toISOString(),
  errorMessage = null
} = {}) {
  if (importId == null) return 0;
  return Number(db.prepare(
    "UPDATE race_data_imports SET status = ?, completed_at = ?, " +
      "completed_rounds = ?, error_message = ? WHERE id = ?"
  ).run(
    String(status), completedAt, Number(completedRounds || 0),
    errorMessage ? String(errorMessage) : null, Number(importId)
  ).changes || 0);
}

function findRaceDataImport(db, importId) {
  const row = db.prepare(
    "SELECT id, season, sync_id, status, source_type, parser_version, started_at, " +
      "completed_at, requested_rounds, completed_rounds, reconstructed, source_note, error_message " +
      "FROM race_data_imports WHERE id = ? LIMIT 1"
  ).get(Number(importId));
  if (!row) return null;
  return {
    ...row, id: Number(row.id), season: Number(row.season),
    requested_rounds: Number(row.requested_rounds || 0),
    completed_rounds: Number(row.completed_rounds || 0),
    reconstructed: Boolean(Number(row.reconstructed || 0))
  };
}

function listRaceDataImports(db, season) {
  return db.prepare(
    "SELECT id, season, sync_id, status, source_type, parser_version, started_at, " +
      "completed_at, requested_rounds, completed_rounds, reconstructed, source_note, error_message " +
      "FROM race_data_imports WHERE season = ? ORDER BY started_at DESC, id DESC"
  ).all(Number(season)).map((row) => ({
    ...row, id: Number(row.id), season: Number(row.season),
    requested_rounds: Number(row.requested_rounds || 0),
    completed_rounds: Number(row.completed_rounds || 0),
    reconstructed: Boolean(Number(row.reconstructed || 0))
  }));
}

function saveRaceDataSnapshot(db, {
  season,
  roundNumber,
  roundName = "",
  syncId,
  importId = null,
  fetchedAt,
  sourceType = SOURCE_TYPES.JOLPICA,
  sourceNote = "",
  parserVersion = "evidence-v1",
  calendarState = "completed",
  reconstructed = false,
  evidence
}) {
  const safeSeason = parseNum(season);
  const safeRound = parseNum(roundNumber);
  if (safeSeason == null || safeRound == null || !syncId || !evidence) {
    throw new Error("Race data snapshot requires season, round, sync id, and evidence.");
  }
  const payload = JSON.stringify(evidence);
  const now = new Date().toISOString();
  const existing = db
    .prepare(
      `SELECT id FROM race_data_snapshots
       WHERE season = ? AND round_number = ? AND sync_id = ?
       LIMIT 1`
    )
    .get(safeSeason, safeRound, String(syncId));
  if (existing) {
    db.prepare(
      `UPDATE race_data_snapshots
       SET import_id = ?, round_name = ?, fetched_at = ?, source_type = ?, source_note = ?,
           parser_version = ?, calendar_state = ?, reconstructed = ?,
           coverage_status = ?, payload_json = ?, created_at = ?
       WHERE id = ?`
    ).run(
      importId == null ? null : Number(importId),
      String(roundName || evidence.roundName || "Round " + safeRound).trim(),
      fetchedAt || evidence.fetchedAt || now,
      sourceType,
      String(sourceNote || "").trim() || null,
      String(parserVersion || "evidence-v1"),
      String(calendarState || "completed"),
      reconstructed ? 1 : 0,
      String(evidence?.coverage?.status || "incomplete"),
      payload,
      now,
      Number(existing.id)
    );
    return Number(existing.id);
  }
  const result = db
    .prepare(
      `INSERT INTO race_data_snapshots (
        import_id, season, round_number, round_name, sync_id, fetched_at, source_type,
        source_note, parser_version, calendar_state, reconstructed,
        coverage_status, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      importId == null ? null : Number(importId),
      safeSeason,
      safeRound,
      String(roundName || evidence.roundName || "Round " + safeRound).trim(),
      String(syncId),
      fetchedAt || evidence.fetchedAt || now,
      sourceType,
      String(sourceNote || "").trim() || null,
      String(parserVersion || "evidence-v1"),
      String(calendarState || "completed"),
      reconstructed ? 1 : 0,
      String(evidence?.coverage?.status || "incomplete"),
      payload,
      now
    );
  return Number(result.lastInsertRowid);
}

function linkEvidenceToActualSnapshot(db, snapshotId, evidenceId, importId = null) {
  const safeSnapshotId = parseNum(snapshotId);
  const safeEvidenceId = parseNum(evidenceId);
  if (safeSnapshotId == null || safeEvidenceId == null) return 0;
  return Number(
    db
      .prepare(
        "UPDATE actual_snapshots SET source_data_import_id = ?, source_data_snapshot_id = ? WHERE id = ?"
      )
      .run(importId == null ? null : Number(importId), safeEvidenceId, safeSnapshotId).changes || 0
  );
}

function listRaceDataSnapshots(db, season) {
  const rows = db
    .prepare(
      `SELECT id, import_id, season, round_number, round_name, sync_id, fetched_at,
              source_type, source_note, parser_version, calendar_state, reconstructed,
              coverage_status, payload_json, created_at
       FROM race_data_snapshots
       WHERE season = ?
       ORDER BY round_number ASC, created_at DESC, id DESC`
    )
    .all(Number(season));
  const latestByRound = new Map();
  rows.forEach((row) => {
    const round = Number(row.round_number);
    if (!latestByRound.has(round)) {
      latestByRound.set(round, {
        ...row,
        id: Number(row.id),
        import_id: row.import_id == null ? null : Number(row.import_id),
        season: Number(row.season),
        round_number: round,
        payload: parseEvidencePayload(row.payload_json)
      });
    }
  });
  return Array.from(latestByRound.values()).sort((a, b) => a.round_number - b.round_number);
}

function findRaceDataSnapshot(db, season, roundNumber) {
  const row = db
    .prepare(
      `SELECT id, import_id, season, round_number, round_name, sync_id, fetched_at,
              source_type, source_note, parser_version, calendar_state, reconstructed,
              coverage_status, payload_json, created_at
       FROM race_data_snapshots
       WHERE season = ? AND round_number = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    )
    .get(Number(season), Number(roundNumber));
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    import_id: row.import_id == null ? null : Number(row.import_id),
    season: Number(row.season),
    round_number: Number(row.round_number),
    payload: parseEvidencePayload(row.payload_json)
  };
}

function findEvidenceForActualSnapshot(db, snapshotId) {
  const row = db
    .prepare(
      `SELECT rds.id, rds.import_id, rds.season, rds.round_number, rds.round_name, rds.sync_id,
              rds.fetched_at, rds.source_type, rds.source_note, rds.parser_version,
              rds.calendar_state, rds.reconstructed,
              rds.coverage_status, rds.payload_json, rds.created_at
       FROM actual_snapshots AS snapshot
       LEFT JOIN race_data_snapshots AS rds
         ON rds.id = snapshot.source_data_snapshot_id
       WHERE snapshot.id = ?
       LIMIT 1`
    )
    .get(Number(snapshotId));
  if (!row || !row.id) return null;
  return {
    ...row,
    id: Number(row.id),
    import_id: row.import_id == null ? null : Number(row.import_id),
    season: Number(row.season),
    round_number: Number(row.round_number),
    payload: parseEvidencePayload(row.payload_json)
  };
}

function summarizeEvidence(payload) {
  const safe = payload || {};
  const coverage = safe.coverage || {};
  const sources = coverage.sources || {};
  return {
    status: coverage.status || "incomplete",
    raceCount: Number(sources.race?.count || 0),
    qualifyingCount: Number(sources.qualifying?.count || 0),
    sprintCount: Number(sources.sprint?.count || 0),
    driverStandingsCount: Number(sources.driverStandings?.count || 0),
    constructorStandingsCount: Number(sources.constructorStandings?.count || 0)
  };
}

module.exports = {
  SOURCE_TYPES,
  buildEvidenceBundle,
  completeRaceDataImport,
  createRaceDataImport,
  ensureRaceDataSchema,
  findEvidenceForActualSnapshot,
  findRaceDataSnapshot,
  findRaceDataImport,
  linkEvidenceToActualSnapshot,
  listRaceDataImports,
  listRaceDataSnapshots,
  normalizeCoverage,
  normalizeLookupKey,
  parseEvidencePayload,
  saveRaceDataSnapshot,
  summarizeEvidence,
  teamNameFromApi,
  driverNameFromApi
};
