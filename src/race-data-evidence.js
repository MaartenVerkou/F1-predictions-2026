"use strict";

const crypto = require("node:crypto");
const {
  DEFAULT_SCORING_RULES,
  reconcileStandings,
  scoreResultRows,
  scoringRulesTableValue
} = require("./season-scoring-rules");

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
  OPENF1: "openf1",
  FORMULA1: "formula1",
  FORMULA1_DASHBOARD: "formula1_dashboard",
  REDDIT_DESTRUCTORS: "reddit_destructors"
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

function canonicalId(catalog, kind, label) {
  const options = catalog?.[kind] || catalog?.[`${kind}s`] || [];
  const key = normalizeLookupKey(label);
  const reference = String(label || "").trim().toLowerCase();
  const match = options.find((option) =>
    String(option.value || "").trim().toLowerCase() === reference
      || normalizeLookupKey(option.label || option.display_name || option.displayName) === key
      || normalizeLookupKey(option.slug) === key
  );
  return match ? Number(match.id) : null;
}

function normalizeResultRow(row, roster, kind, canonicalCatalog = null) {
  const driver = driverNameFromApi(row?.Driver, roster?.drivers || []);
  const constructor = teamNameFromApi(row?.Constructor, roster?.teams || []);
  if (!driver && !constructor) return null;
  const positionRaw = String(row?.position == null ? "" : row.position).trim();
  const position = positionRaw === "" ? null : parseNum(positionRaw);
  return {
    driver,
    constructor,
    driver_label: driver,
    team_label: constructor,
    driver_id: canonicalId(canonicalCatalog, "driver", driver),
    team_id: canonicalId(canonicalCatalog, "team", constructor),
    provider_driver_id: String(row?.Driver?.driverId || "").trim() || null,
    provider_team_id: String(row?.Constructor?.constructorId || "").trim() || null,
    number: String(row?.number || "").trim() || null,
    grid: parseNum(row?.grid),
    position,
    positionText: position != null ? String(position) : positionRaw || null,
    status: String(row?.status || "").trim() || null,
    points: parseNum(row?.points, 0),
    laps: parseNum(row?.laps),
    raceTime: String(row?.Time?.time || "").trim() || null,
    fastestLap: String(row?.FastestLap?.rank || "").trim() === "1",
    fastestLapTime: String(row?.FastestLap?.Time?.time || "").trim() || null,
    fastestLapAverageSpeed: parseNum(row?.FastestLap?.AverageSpeed?.speed),
    qualifyingTimes: kind === "qualifying" ? {
      q1: String(row?.Q1 || "").trim() || null,
      q2: String(row?.Q2 || "").trim() || null,
      q3: String(row?.Q3 || "").trim() || null
    } : null,
    pole: kind === "qualifying" && position === 1
  };
}

function normalizeStandingsRow(row, roster, entityType, canonicalCatalog = null) {
  const entity = row?.entity
    || (entityType === "driver"
      ? driverNameFromApi(row?.Driver, roster?.drivers || [])
      : teamNameFromApi(row?.Constructor, roster?.teams || []));
  if (!entity) return null;
  return {
    entity,
    entity_label: entity,
    entity_id: canonicalCatalog
      ? canonicalId(canonicalCatalog, entityType === "driver" ? "driver" : "team", entity)
      : row?.entity_id == null ? null : Number(row.entity_id),
    provider_entity_id: String((entityType === "driver" ? row?.Driver?.driverId : row?.Constructor?.constructorId) || "").trim() || null,
    position: parseNum(row?.position),
    points: parseNum(row?.points, 0),
    wins: parseNum(row?.wins, 0),
    podiums: parseNum(row?.podiums, 0)
  };
}

function normalizeSourceRows(rows, roster, kind, canonicalCatalog = null) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => normalizeResultRow(row, roster, kind, canonicalCatalog))
    .filter(Boolean);
}

function normalizeDamageRow(row, roster, canonicalCatalog = null) {
  const rawDriver = String(row?.driverName || row?.driver || "").trim();
  const rawTeam = String(row?.constructorName || row?.constructor || row?.team || "").trim();
  const driver = resolveCanonicalName(rawDriver, roster?.drivers || [], DRIVER_NAME_ALIASES) || rawDriver || null;
  const constructor = resolveCanonicalName(rawTeam, roster?.teams || [], TEAM_NAME_ALIASES) || rawTeam || null;
  const components = (Array.isArray(row?.components) ? row.components : []).map((component) => {
    const parsedPrice = parseNum(component?.price);
    const price = parsedPrice == null ? null : Math.max(0, parsedPrice);
    const quantity = Math.max(0, parseNum(component?.quantity, 1));
    return {
      component_id: component?.componentId == null ? null : String(component.componentId),
      name: String(component?.name || "Unknown component").trim(),
      price,
      quantity,
      total_cost: price == null ? null : price * quantity
    };
  });
  const parsedTotal = parseNum(row?.totalCost);
  const componentTotal = components.every((component) => component.total_cost != null)
    ? components.reduce((sum, component) => sum + component.total_cost, 0)
    : null;
  const totalCost = parsedTotal != null
    ? Math.max(0, parsedTotal)
    : componentTotal == null ? null : Math.max(0, componentTotal);
  return {
    round: parseNum(row?.round),
    driver,
    constructor,
    driver_label: driver,
    team_label: constructor,
    driver_id: canonicalId(canonicalCatalog, "driver", driver),
    team_id: canonicalId(canonicalCatalog, "team", constructor),
    provider_driver_id: row?.driverId == null ? null : String(row.driverId),
    provider_team_id: row?.constructorId == null ? null : String(row.constructorId),
    driver_number: row?.driverNumber == null ? null : String(row.driverNumber),
    driver_code: row?.driverCode == null ? null : String(row.driverCode).trim().toUpperCase() || null,
    grand_prix_id: row?.grandPrixId == null ? null : String(row.grandPrixId),
    grand_prix_country: row?.grandPrixCountry || null,
    components,
    totalCost,
    cost_status: totalCost == null ? "unresolved" : "resolved",
    source_text: row?.sourceText == null ? null : String(row.sourceText),
    resolution: row?.resolution || null
  };
}

function normalizeCoverage({
  race = [],
  qualifying = [],
  sprint = [],
  practice1 = [],
  practice2 = [],
  practice3 = [],
  sprintQualifying = [],
  startingGrid = [],
  damage = [],
  damageAvailable = null,
  driverStandings = [],
  constructorStandings = []
}) {
  const coverage = {
    race: { available: race.length > 0, count: race.length },
    qualifying: { available: qualifying.length > 0, count: qualifying.length },
    sprint: { available: sprint.length > 0, count: sprint.length },
    practice1: { available: practice1.length > 0, count: practice1.length },
    practice2: { available: practice2.length > 0, count: practice2.length },
    practice3: { available: practice3.length > 0, count: practice3.length },
    sprintQualifying: { available: sprintQualifying.length > 0, count: sprintQualifying.length },
    startingGrid: { available: startingGrid.length > 0, count: startingGrid.length },
    damage: { available: damageAvailable == null ? damage.length > 0 : Boolean(damageAvailable), count: damage.length },
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

function buildEvidenceBundle({
  data,
  roster,
  roundNumber,
  roundName,
  fetchedAt,
  sourceUrls = {},
  canonicalCatalog = null,
  catalogRevision = null,
  cutoffRound = null,
  sourceIdentity = null,
  payloadRevision = null,
  provider = null,
  providerSchema = null,
  provenance = null,
  scoringRules = DEFAULT_SCORING_RULES
}) {
  const round = Number(roundNumber);
  const race = (data?.results || []).find((item) => Number(item?.round) === round) || {};
  const qualifyingRace =
    (data?.qualifying || []).find((item) => Number(item?.round) === round) || {};
  const sprintRace =
    (data?.sprints || []).find((item) => Number(item?.round) === round) || {};
  const providerSessions = data?.sessionsByRound instanceof Map
    ? data.sessionsByRound.get(round) || {}
    : {};
  const sessionRows = (key, kind = key) => normalizeSourceRows(
    providerSessions?.[key]?.rows || [],
    roster,
    kind,
    canonicalCatalog
  );
  const driverStandings = data?.driverStandingsByRound?.get(round) || [];
  const constructorStandings = data?.constructorStandingsByRound?.get(round) || [];
  const canonicalRaceRows = sessionRows("race", "race");
  const canonicalQualifyingRows = sessionRows("qualifying", "qualifying");
  const canonicalSprintRows = sessionRows("sprint", "sprint");
  const rawRaceRows = canonicalRaceRows.length
    ? canonicalRaceRows
    : normalizeSourceRows(race.Results, roster, "race", canonicalCatalog);
  const raceRows = scoreResultRows(rawRaceRows, "race", scoringRules);
  const qualifyingRows = canonicalQualifyingRows.length
    ? canonicalQualifyingRows
    : normalizeSourceRows(
        qualifyingRace.QualifyingResults,
        roster,
        "qualifying", canonicalCatalog
      );
  const rawSprintRows = canonicalSprintRows.length
    ? canonicalSprintRows
    : normalizeSourceRows(sprintRace.SprintResults, roster, "sprint", canonicalCatalog);
  const sprintRows = scoreResultRows(rawSprintRows, "sprint", scoringRules);
  const practice1Rows = sessionRows("practice1", "practice");
  const practice2Rows = sessionRows("practice2", "practice");
  const practice3Rows = sessionRows("practice3", "practice");
  const sprintQualifyingRows = sessionRows("sprintQualifying", "qualifying");
  const startingGridRows = sessionRows("startingGrid", "race");
  const effectiveStartingGridRows = startingGridRows.length
    ? startingGridRows
    : raceRows.filter((row) => row.grid != null);
  const sessionPayload = (key, rows, fallback = {}) => ({
    provider: fallback.provider || provider || data?.provider || null,
    providerSchema: fallback.providerSchema || providerSchema || data?.providerSchema || null,
    sessionKey: fallback.sessionKey || null,
    meetingKey: fallback.meetingKey || null,
    sessionName: fallback.sessionName || key,
    sessionType: fallback.sessionType || null,
    dateStart: fallback.dateStart || null,
    dateEnd: fallback.dateEnd || null,
    available: fallback.available == null ? rows.length > 0 : Boolean(fallback.available),
    status: fallback.status || (rows.length > 0 ? "available" : "unavailable"),
    unavailableReason: fallback.unavailableReason || (rows.length > 0 ? null : "No persisted rows"),
    sourceUrl: fallback.sourceUrl || null,
    rows
  });
  const damageMap = data?.destructorsByRound instanceof Map
    ? data.destructorsByRound
    : data?.damageByRound instanceof Map ? data.damageByRound : null;
  const damageSourceRows = damageMap?.get(round) || [];
  const damageRows = damageSourceRows
    .map((row) => normalizeDamageRow(row, roster, canonicalCatalog))
    .filter((row) => row.round != null && row.driver);
  const destructorsError = data?.destructorsErrorsByRound?.get(round) || data?.destructorsError || null;
  const damageSourceAvailable = damageMap instanceof Map && damageRows.length > 0 && !destructorsError;
  const normalizedDriverStandings = driverStandings
    .map((row) => normalizeStandingsRow(row, roster, "driver", canonicalCatalog))
    .filter(Boolean);
  const normalizedConstructorStandings = constructorStandings
    .map((row) => normalizeStandingsRow(row, roster, "constructor", canonicalCatalog))
    .filter(Boolean);
  const coverage = normalizeCoverage({
    race: raceRows,
    qualifying: qualifyingRows,
    sprint: sprintRows,
    practice1: practice1Rows,
    practice2: practice2Rows,
    practice3: practice3Rows,
    sprintQualifying: sprintQualifyingRows,
    startingGrid: effectiveStartingGridRows,
    damage: damageRows,
    damageAvailable: damageSourceAvailable,
    driverStandings: normalizedDriverStandings,
    constructorStandings: normalizedConstructorStandings
  });
  const unresolved = canonicalCatalog
    ? {
        raceDrivers: raceRows.filter((row) => row.driver && row.driver_id == null).length,
        raceTeams: raceRows.filter((row) => row.constructor && row.team_id == null).length,
        qualifyingDrivers: qualifyingRows.filter((row) => row.driver && row.driver_id == null).length,
        qualifyingTeams: qualifyingRows.filter((row) => row.constructor && row.team_id == null).length,
        sprintDrivers: sprintRows.filter((row) => row.driver && row.driver_id == null).length,
        sprintTeams: sprintRows.filter((row) => row.constructor && row.team_id == null).length,
        damageDrivers: damageRows.filter((row) => row.driver && row.driver_id == null).length,
        damageTeams: damageRows.filter((row) => row.constructor && row.team_id == null).length,
        damageCosts: damageRows.filter((row) => row.cost_status !== "resolved").length,
        standingsDrivers: normalizedDriverStandings.filter((row) => row.entity && row.entity_id == null).length,
        standingsTeams: normalizedConstructorStandings.filter((row) => row.entity && row.entity_id == null).length
      }
    : null;
  if (unresolved && Object.values(unresolved).some((value) => value > 0)) {
    coverage.status = "incomplete";
  }
  return {
    schemaVersion: 3,
    season: parseNum(data?.season, null),
    roundNumber: round,
    roundName: String(roundName || race?.raceName || `Round ${round}`).trim(),
    fetchedAt: fetchedAt || new Date().toISOString(),
    catalogRevision: String(catalogRevision || "").trim() || null,
    cutoffRound: parseNum(cutoffRound, round),
    sourceIdentity: String(sourceIdentity || "").trim() || null,
    payloadRevision: String(payloadRevision || "").trim() || null,
    unresolved,
    scoringRules: scoringRulesTableValue(scoringRules),
    sourceUrls: {
      race: sourceUrls.race || null,
      qualifying: sourceUrls.qualifying || null,
      sprint: sourceUrls.sprint || null,
      practice1: sourceUrls.practice1 || null,
      practice2: sourceUrls.practice2 || null,
      practice3: sourceUrls.practice3 || null,
      sprintQualifying: sourceUrls.sprintQualifying || null,
      startingGrid: sourceUrls.startingGrid || null,
      damage: sourceUrls.damage || null,
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
    practice: {
      practice1: { rows: practice1Rows },
      practice2: { rows: practice2Rows },
      practice3: { rows: practice3Rows }
    },
    sprintQualifying: { rows: sprintQualifyingRows },
    sessions: {
      practice1: sessionPayload("practice1", practice1Rows, providerSessions.practice1),
      practice2: sessionPayload("practice2", practice2Rows, providerSessions.practice2),
      practice3: sessionPayload("practice3", practice3Rows, providerSessions.practice3),
      sprintQualifying: sessionPayload(
        "sprintQualifying",
        sprintQualifyingRows,
        providerSessions.sprintQualifying
      ),
      sprint: sessionPayload("sprint", sprintRows, providerSessions.sprint),
      qualifying: sessionPayload("qualifying", qualifyingRows, providerSessions.qualifying),
      startingGrid: sessionPayload(
        "startingGrid",
        effectiveStartingGridRows,
        providerSessions.startingGrid
      ),
      race: sessionPayload("race", raceRows, providerSessions.race)
    },
    standings: {
      drivers: normalizedDriverStandings,
      constructors: normalizedConstructorStandings
    },
    legacyStandings: {
      drivers: data?.legacyDriverStandingsByRound?.get(round) || [],
      constructors: data?.legacyConstructorStandingsByRound?.get(round) || []
    },
    reconciliation: data?.reconciliationByRound?.get(round) || {
      drivers: reconcileStandings([], normalizedDriverStandings),
      constructors: reconcileStandings([], normalizedConstructorStandings)
    },
    external: {
      driverOfTheDay: data?.driverOfTheDayByRound?.get(round) || null,
      driverOfTheDayId: canonicalId(canonicalCatalog, "driver", data?.driverOfTheDayByRound?.get(round)),
      damage: {
        available: damageSourceAvailable,
        rows: damageRows,
        error: destructorsError
      }
    },
    raw: {
      provider: String(provider || data?.provider || "openf1"),
      providerSchema: String(providerSchema || data?.providerSchema || "openf1-v1"),
      provenance: provenance || data?.provenanceByRound?.get(round) || null,
      race,
      qualifying: qualifyingRace,
      sprint: sprintRace,
      sessions: providerSessions,
      destructors: damageSourceRows,
      driverStandings,
      constructorStandings
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
      "catalog_revision TEXT, source_identity TEXT, payload_revision TEXT, cutoff_round INTEGER, " +
      "unresolved_count INTEGER NOT NULL DEFAULT 0, revision_kind TEXT NOT NULL DEFAULT 'provider', " +
      "supersedes_snapshot_id INTEGER, correction_reason TEXT, corrected_by_user_id INTEGER, corrected_at TEXT, " +
      "payload_json TEXT NOT NULL, created_at TEXT NOT NULL, " +
      "UNIQUE(season, round_number, sync_id)); " +
    "CREATE INDEX IF NOT EXISTS idx_race_data_snapshots_season_round " +
      "ON race_data_snapshots(season, round_number, created_at); " +
    "CREATE INDEX IF NOT EXISTS idx_race_data_snapshots_import " +
      "ON race_data_snapshots(import_id, round_number);" +
    " CREATE TABLE IF NOT EXISTS destructors_source_posts (" + identity + ", " +
      "provider TEXT NOT NULL, post_id TEXT NOT NULL, season INTEGER NOT NULL, " +
      "round_number INTEGER, round_name TEXT, post_url TEXT, author TEXT, title TEXT, " +
      "published_at TEXT, source_updated_at TEXT, fetched_at TEXT NOT NULL, content_hash TEXT NOT NULL, " +
      "body_text TEXT, body_html TEXT, image_urls_json TEXT, parser_version TEXT NOT NULL, " +
      "status TEXT NOT NULL, warnings_json TEXT, normalized_json TEXT, headers_json TEXT, " +
      "last_error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, " +
      "UNIQUE(provider, post_id)); " +
    "CREATE INDEX IF NOT EXISTS idx_destructors_source_posts_season_round " +
      "ON destructors_source_posts(season, round_number, updated_at); " +
    "CREATE INDEX IF NOT EXISTS idx_destructors_source_posts_hash " +
      "ON destructors_source_posts(provider, content_hash);"
  );

  const snapshotColumns = listColumnNames(db, "race_data_snapshots");
  const additions = [
    ["import_id", "INTEGER"],
    ["parser_version", "TEXT NOT NULL DEFAULT 'evidence-v1'"],
    ["calendar_state", "TEXT NOT NULL DEFAULT 'completed'"],
    ["reconstructed", "INTEGER NOT NULL DEFAULT 0"],
    ["catalog_revision", "TEXT"],
    ["source_identity", "TEXT"],
    ["payload_revision", "TEXT"],
    ["cutoff_round", "INTEGER"],
    ["unresolved_count", "INTEGER NOT NULL DEFAULT 0"],
    ["revision_kind", "TEXT NOT NULL DEFAULT 'provider'"],
    ["supersedes_snapshot_id", "INTEGER"],
    ["correction_reason", "TEXT"],
    ["corrected_by_user_id", "INTEGER"],
    ["corrected_at", "TEXT"]
  ];
  for (const [name, type] of additions) {
    if (!snapshotColumns.has(name)) {
      db.exec("ALTER TABLE race_data_snapshots ADD COLUMN " + name + " " + type + ";");
    }
  }
  db.exec(
    "UPDATE race_data_snapshots SET parser_version = COALESCE(NULLIF(parser_version, ''), 'evidence-v1'), " +
      "calendar_state = COALESCE(NULLIF(calendar_state, ''), 'completed'), " +
      "reconstructed = COALESCE(reconstructed, 0), " +
      "revision_kind = COALESCE(NULLIF(revision_kind, ''), 'provider') " +
      "WHERE parser_version IS NULL OR parser_version = '' OR calendar_state IS NULL OR " +
      "calendar_state = '' OR reconstructed IS NULL OR revision_kind IS NULL OR revision_kind = '';"
  );
}

function parseJsonColumn(value, fallback) {
  if (value == null || value === "") return fallback;
  try { return JSON.parse(String(value)); } catch (error) { return fallback; }
}

function mapRaceDataSnapshotRow(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    import_id: row.import_id == null ? null : Number(row.import_id),
    season: Number(row.season),
    round_number: Number(row.round_number),
    reconstructed: Boolean(Number(row.reconstructed || 0)),
    unresolved_count: Number(row.unresolved_count || 0),
    revision_kind: String(row.revision_kind || "provider"),
    supersedes_snapshot_id: row.supersedes_snapshot_id == null ? null : Number(row.supersedes_snapshot_id),
    corrected_by_user_id: row.corrected_by_user_id == null ? null : Number(row.corrected_by_user_id),
    payload: parseEvidencePayload(row.payload_json)
  };
}

function mapDestructorsSourcePost(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    season: Number(row.season),
    round_number: row.round_number == null ? null : Number(row.round_number),
    image_urls: parseJsonColumn(row.image_urls_json, []),
    warnings: parseJsonColumn(row.warnings_json, []),
    normalized: parseJsonColumn(row.normalized_json, null),
    headers: parseJsonColumn(row.headers_json, {})
  };
}

function findDestructorsSourcePost(db, provider, postId) {
  const row = db.prepare(
    "SELECT id, provider, post_id, season, round_number, round_name, post_url, author, title, " +
      "published_at, source_updated_at, fetched_at, content_hash, body_text, body_html, image_urls_json, " +
      "parser_version, status, warnings_json, normalized_json, headers_json, last_error, created_at, updated_at " +
      "FROM destructors_source_posts WHERE provider = ? AND post_id = ? LIMIT 1"
  ).get(String(provider), String(postId));
  return mapDestructorsSourcePost(row);
}

function saveDestructorsSourcePost(db, {
  provider = SOURCE_TYPES.REDDIT_DESTRUCTORS,
  postId,
  season,
  roundNumber = null,
  roundName = null,
  postUrl = null,
  author = null,
  title = null,
  publishedAt = null,
  updatedAt = null,
  fetchedAt = new Date().toISOString(),
  contentHash,
  bodyText = null,
  bodyHtml = null,
  imageUrls = [],
  parserVersion = "reddit-destructors-rss-v1",
  status = "pending_review",
  warnings = [],
  normalized = null,
  headers = {},
  lastError = null
}) {
  if (!postId || !Number.isFinite(Number(season)) || !contentHash) {
    throw new Error("Destructors source post requires post id, season, and content hash.");
  }
  const now = new Date().toISOString();
  const existing = findDestructorsSourcePost(db, provider, postId);
  const values = [
    Number(season), roundNumber == null ? null : Number(roundNumber), String(roundName || "").trim() || null,
    String(postUrl || "").trim() || null, String(author || "").trim() || null, String(title || "").trim() || null,
    publishedAt || null, updatedAt || null, fetchedAt || now, String(contentHash),
    bodyText == null ? null : String(bodyText), bodyHtml == null ? null : String(bodyHtml), JSON.stringify(imageUrls || []),
    String(parserVersion), String(status), JSON.stringify(warnings || []), normalized == null ? null : JSON.stringify(normalized),
    JSON.stringify(headers || {}), lastError == null ? null : String(lastError), now
  ];
  if (existing) {
    db.prepare(
      "UPDATE destructors_source_posts SET season = ?, round_number = ?, round_name = ?, post_url = ?, " +
        "author = ?, title = ?, published_at = ?, source_updated_at = ?, fetched_at = ?, content_hash = ?, body_text = ?, " +
        "body_html = ?, image_urls_json = ?, parser_version = ?, status = ?, warnings_json = ?, normalized_json = ?, " +
        "headers_json = ?, last_error = ?, updated_at = ? WHERE id = ?"
    ).run(...values, Number(existing.id));
    return Number(existing.id);
  }
  const result = db.prepare(
    "INSERT INTO destructors_source_posts (provider, post_id, season, round_number, round_name, post_url, author, title, " +
      "published_at, source_updated_at, fetched_at, content_hash, body_text, body_html, image_urls_json, parser_version, status, " +
      "warnings_json, normalized_json, headers_json, last_error, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(String(provider), String(postId), ...values, now);
  return Number(result.lastInsertRowid);
}

function listDestructorsSourcePosts(db, season, { roundNumber = null } = {}) {
  const rows = roundNumber == null
    ? db.prepare("SELECT * FROM destructors_source_posts WHERE season = ? ORDER BY published_at ASC, id ASC").all(Number(season))
    : db.prepare("SELECT * FROM destructors_source_posts WHERE season = ? AND round_number = ? ORDER BY published_at ASC, id ASC").all(Number(season), Number(roundNumber));
  return rows.map(mapDestructorsSourcePost);
}

function createRaceDataImport(db, {
  season,
  syncId,
  sourceType = SOURCE_TYPES.OPENF1,
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
  sourceType = SOURCE_TYPES.OPENF1,
  sourceNote = "",
  parserVersion = "evidence-v1",
  calendarState = "completed",
  reconstructed = false,
  catalogRevision = null,
  sourceIdentity = null,
  payloadRevision = null,
  cutoffRound = null,
  revisionKind = "provider",
  supersedesSnapshotId = null,
  correctionReason = null,
  correctedByUserId = null,
  correctedAt = null,
  evidence
}) {
  const safeSeason = parseNum(season);
  const safeRound = parseNum(roundNumber);
  if (safeSeason == null || safeRound == null || !syncId || !evidence) {
    throw new Error("Race data snapshot requires season, round, sync id, and evidence.");
  }
  const payload = JSON.stringify(evidence);
  const now = new Date().toISOString();
  const safeCutoffRound = cutoffRound == null
    ? parseNum(evidence.cutoffRound, safeRound)
    : parseNum(cutoffRound, safeRound);
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
           catalog_revision = ?, source_identity = ?, payload_revision = ?, cutoff_round = ?,
           unresolved_count = ?, coverage_status = ?, payload_json = ?, created_at = ?
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
      String(catalogRevision || evidence.catalogRevision || "").trim() || null,
      String(sourceIdentity || evidence.sourceIdentity || "").trim() || null,
      String(payloadRevision || evidence.payloadRevision || "").trim() || null,
      safeCutoffRound,
      evidence.unresolved ? Object.values(evidence.unresolved).reduce((total, value) => total + Number(value || 0), 0) : 0,
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
       catalog_revision, source_identity, payload_revision, cutoff_round, unresolved_count,
       coverage_status, revision_kind, supersedes_snapshot_id, correction_reason,
       corrected_by_user_id, corrected_at, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
     String(catalogRevision || evidence.catalogRevision || "").trim() || null,
     String(sourceIdentity || evidence.sourceIdentity || "").trim() || null,
     String(payloadRevision || evidence.payloadRevision || "").trim() || null,
     safeCutoffRound,
     evidence.unresolved ? Object.values(evidence.unresolved).reduce((total, value) => total + Number(value || 0), 0) : 0,
     String(evidence?.coverage?.status || "incomplete"),
     String(revisionKind || "provider").trim() || "provider",
     supersedesSnapshotId == null ? null : parseNum(supersedesSnapshotId),
     String(correctionReason || "").trim() || null,
     correctedByUserId == null ? null : parseNum(correctedByUserId),
     correctedAt || null,
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

function listRaceDataSnapshotRevisions(db, season, roundNumber) {
  const rows = db
    .prepare(
      `SELECT id, import_id, season, round_number, round_name, sync_id, fetched_at,
              source_type, source_note, parser_version, calendar_state, reconstructed,
              catalog_revision, source_identity, payload_revision, cutoff_round, unresolved_count,
              coverage_status, revision_kind, supersedes_snapshot_id, correction_reason,
              corrected_by_user_id, corrected_at, payload_json, created_at
       FROM race_data_snapshots
       WHERE season = ? AND round_number = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(Number(season), Number(roundNumber));
  return rows.map(mapRaceDataSnapshotRow);
}

function saveCorrectedRaceDataSnapshot(db, {
  baseSnapshot,
  evidence,
  correctedByUserId,
  correctionReason,
  roundName = baseSnapshot?.round_name,
  sourceNote = "Admin correction"
}) {
  const season = parseNum(baseSnapshot?.season);
  const roundNumber = parseNum(baseSnapshot?.round_number);
  const userId = parseNum(correctedByUserId);
  const reason = String(correctionReason || "").trim();
  if (!baseSnapshot?.id || season == null || roundNumber == null || !evidence || userId == null || !reason) {
    throw new Error("A correction requires a base snapshot, evidence, admin, and reason.");
  }
  const now = new Date().toISOString();
  return saveRaceDataSnapshot(db, {
    season,
    roundNumber,
    roundName,
    syncId: `admin-correction-${season}-${roundNumber}-${crypto.randomUUID()}`,
    fetchedAt: now,
    sourceType: "admin_correction",
    sourceNote,
    parserVersion: baseSnapshot.parser_version || "evidence-v1",
    calendarState: baseSnapshot.calendar_state || "completed",
    reconstructed: true,
    catalogRevision: baseSnapshot.catalog_revision || null,
    sourceIdentity: baseSnapshot.source_identity || null,
    payloadRevision: `admin-${crypto.randomUUID()}`,
    cutoffRound: baseSnapshot.cutoff_round || roundNumber,
    revisionKind: "admin_correction",
    supersedesSnapshotId: Number(baseSnapshot.id),
    correctionReason: reason,
    correctedByUserId: userId,
    correctedAt: now,
    evidence
  });
}

function listRaceDataSnapshots(db, season) {
  const rows = db
    .prepare(
      `SELECT id, import_id, season, round_number, round_name, sync_id, fetched_at,
              source_type, source_note, parser_version, calendar_state, reconstructed,
              catalog_revision, source_identity, payload_revision, cutoff_round, unresolved_count,
              coverage_status, revision_kind, supersedes_snapshot_id, correction_reason,
              corrected_by_user_id, corrected_at, payload_json, created_at
       FROM race_data_snapshots
       WHERE season = ?
       ORDER BY round_number ASC, created_at DESC, id DESC`
    )
    .all(Number(season));
  const latestByRound = new Map();
  rows.forEach((row) => {
    const round = Number(row.round_number);
    if (!latestByRound.has(round)) {
      latestByRound.set(round, mapRaceDataSnapshotRow(row));
    }
  });
  return Array.from(latestByRound.values()).sort((a, b) => a.round_number - b.round_number);
}

function findRaceDataSnapshot(db, season, roundNumber) {
  const row = db
    .prepare(
      `SELECT id, import_id, season, round_number, round_name, sync_id, fetched_at,
              source_type, source_note, parser_version, calendar_state, reconstructed,
              catalog_revision, source_identity, payload_revision, cutoff_round, unresolved_count,
              coverage_status, revision_kind, supersedes_snapshot_id, correction_reason,
              corrected_by_user_id, corrected_at, payload_json, created_at
       FROM race_data_snapshots
       WHERE season = ? AND round_number = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    )
    .get(Number(season), Number(roundNumber));
  if (!row) return null;
  return mapRaceDataSnapshotRow(row);
}

function findEvidenceForActualSnapshot(db, snapshotId) {
  const row = db
    .prepare(
      `SELECT rds.id, rds.import_id, rds.season, rds.round_number, rds.round_name, rds.sync_id,
              rds.fetched_at, rds.source_type, rds.source_note, rds.parser_version,
              rds.calendar_state, rds.reconstructed, rds.catalog_revision,
              rds.source_identity, rds.payload_revision, rds.cutoff_round,
              rds.unresolved_count, rds.coverage_status, rds.revision_kind,
              rds.supersedes_snapshot_id, rds.correction_reason,
              rds.corrected_by_user_id, rds.corrected_at, rds.payload_json, rds.created_at
       FROM actual_snapshots AS snapshot
       LEFT JOIN race_data_snapshots AS rds
         ON rds.id = snapshot.source_data_snapshot_id
       WHERE snapshot.id = ?
       LIMIT 1`
    )
    .get(Number(snapshotId));
  if (!row || !row.id) return null;
  return mapRaceDataSnapshotRow(row);
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
    damageCount: Number(sources.damage?.count || 0),
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
  findDestructorsSourcePost,
  findRaceDataSnapshot,
  findRaceDataImport,
  linkEvidenceToActualSnapshot,
  listRaceDataSnapshotRevisions,
  listRaceDataImports,
  listDestructorsSourcePosts,
  listRaceDataSnapshots,
  normalizeCoverage,
  normalizeDamageRow,
  normalizeLookupKey,
  parseEvidencePayload,
  saveDestructorsSourcePost,
  saveCorrectedRaceDataSnapshot,
  saveRaceDataSnapshot,
  summarizeEvidence,
  teamNameFromApi,
  driverNameFromApi
};
