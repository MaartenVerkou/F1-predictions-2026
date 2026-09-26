"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  DEFAULT_AUTHOR,
  DEFAULT_FEED_URL,
  PROVIDER,
  PROVIDER_SCHEMA,
  fetchFeed,
  mapDamageRows,
  selectCandidates,
  stableHash
} = require("../src/reddit-destructors-provider");
const {
  SOURCE_TYPES,
  ensureRaceDataSchema,
  findRaceDataSnapshot,
  findDestructorsSourcePost,
  linkEvidenceToActualSnapshot,
  normalizeDamageRow,
  saveDestructorsSourcePost,
  saveRaceDataSnapshot,
  createRaceDataImport,
  completeRaceDataImport
} = require("../src/race-data-evidence");
const { createAppDatabase } = require("../src/app-database");
const { ensurePostgresSchema } = require("../src/postgres-schema");
const { ensureSeasonInputsSchema } = require("../src/season-inputs");
const { buildSeasonCatalog } = require("../src/season-catalog");
const {
  ensureActualSnapshotColumns,
  ensurePublishedActualsSchema,
  upsertSnapshotForRound,
  REVIEW_STATUS_PENDING
} = require("../src/actuals-snapshots");
const { deriveSnapshotsFromPersistedEvidence } = require("./backfill-actuals-2026");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const QUESTIONS_PATH = process.env.QUESTIONS_PATH || path.join(DATA_DIR, "questions.json");
function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    season: Number(process.env.F1_SEASON || 2026),
    round: null,
    feedUrl: String(process.env.DESTRUCTORS_REDDIT_FEED_URL || DEFAULT_FEED_URL),
    author: String(process.env.DESTRUCTORS_REDDIT_AUTHOR || DEFAULT_AUTHOR),
    dbPath: process.env.DB_PATH || path.join(DATA_DIR, "app.db"),
    databaseUrl: String(process.env.DATABASE_URL || "").trim()
  };
  for (const arg of argv) {
    if (arg === "--apply") { args.apply = true; args.dryRun = false; continue; }
    if (arg === "--dry-run") { args.apply = false; args.dryRun = true; continue; }
    if (arg.startsWith("--season=")) { args.season = Number(arg.slice(9)); continue; }
    if (arg.startsWith("--round=")) { args.round = Number(arg.slice(8)); continue; }
    if (arg.startsWith("--feed=")) { args.feedUrl = String(arg.slice(7)).trim(); continue; }
    if (arg.startsWith("--author=")) { args.author = String(arg.slice(9)).trim(); continue; }
    if (arg.startsWith("--db=")) { args.dbPath = path.resolve(arg.slice(5)); continue; }
    if (arg.startsWith("--database-url=")) { args.databaseUrl = String(arg.slice(16)).trim(); continue; }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(args.season) || args.season < 1950) throw new Error("--season must be a valid year.");
  if (args.round != null && (!Number.isInteger(args.round) || args.round < 1)) throw new Error("--round must be positive.");
  if (!args.feedUrl || !/^https:\/\//i.test(args.feedUrl)) throw new Error("--feed must be an HTTPS URL.");
  return args;
}

function readQuestions() {
  try {
    return JSON.parse(fs.readFileSync(QUESTIONS_PATH, "utf8").replace(/^\uFEFF/, "")).questions || [];
  } catch (error) {
    return [];
  }
}

function rosterForRound(catalog, round) {
  const teams = new Map((catalog.teams || []).map((team) => [Number(team.id), team]));
  const assignments = (catalog.assignments || []).filter((assignment) => {
    const from = Number(assignment.from_round);
    const to = assignment.to_round == null ? null : Number(assignment.to_round);
    return from <= Number(round) && (to == null || to >= Number(round));
  });
  const assignmentByDriver = new Map();
  assignments.forEach((assignment) => {
    if (!assignmentByDriver.has(Number(assignment.driver_id))) assignmentByDriver.set(Number(assignment.driver_id), assignment);
  });
  return {
    drivers: (catalog.drivers || []).map((driver) => {
      const assignment = assignmentByDriver.get(Number(driver.id));
      const team = assignment ? teams.get(Number(assignment.team_id)) : null;
      return {
        id: Number(driver.id),
        display_name: String(driver.display_name_override || driver.display_name || "").trim(),
        driver_code: driver.driver_code || null,
        team: team ? { id: Number(team.id), display_name: String(team.display_name_override || team.display_name || "").trim() } : null
      };
    }),
    teams: (catalog.teams || []).map((team) => String(team.display_name_override || team.display_name || "").trim()).filter(Boolean)
  };
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function updateDamageEvidence(existingPayload, { args, candidate, mapped, normalizedRows }) {
  const payload = clone(existingPayload) || {
    schemaVersion: 2,
    season: args.season,
    roundNumber: mapped.round,
    roundName: mapped.roundName || `Round ${mapped.round}`,
    fetchedAt: new Date().toISOString(),
    sourceUrls: {},
    coverage: { status: "incomplete", sources: {} },
    race: { rows: [] },
    qualifying: { rows: [] },
    sprint: { rows: [] },
    standings: { drivers: [], constructors: [] },
    unresolved: {}
  };
  payload.schemaVersion = Number(payload.schemaVersion || 2);
  payload.season = args.season;
  payload.roundNumber = Number(mapped.round || payload.roundNumber);
  payload.roundName = mapped.roundName || payload.roundName || `Round ${payload.roundNumber}`;
  payload.fetchedAt = new Date().toISOString();
  payload.sourceUrls = { ...(payload.sourceUrls || {}), damage: candidate.url };
  payload.coverage = payload.coverage || { status: "incomplete", sources: {} };
  payload.coverage.sources = payload.coverage.sources || {};
  payload.coverage.sources.damage = {
    available: normalizedRows.length > 0,
    count: normalizedRows.length
  };
  const warnings = Array.from(new Set(mapped.warnings || []));
  payload.external = payload.external || {};
  payload.external.damage = {
    available: normalizedRows.length > 0,
    rows: normalizedRows,
    error: warnings.includes("damage_rows_missing") || warnings.includes("damage_list_missing") ? warnings.join(";") : null,
    source: {
      provider: PROVIDER,
      postId: candidate.id,
      url: candidate.url,
      author: candidate.author,
      title: candidate.title,
      publishedAt: candidate.publishedAt || null,
      parserVersion: PROVIDER_SCHEMA,
      warnings
    }
  };
  payload.raw = payload.raw || {};
  payload.raw.destructors = mapped.rows;
  payload.raw.destructorsSource = {
    provider: PROVIDER,
    postId: candidate.id,
    url: candidate.url,
    bodyText: candidate.bodyText,
    imageUrls: candidate.imageUrls || []
  };
  payload.unresolved = { ...(payload.unresolved || {}) };
  payload.unresolved.damageDrivers = normalizedRows.filter((row) => row.driver && row.driver_id == null).length;
  payload.unresolved.damageTeams = normalizedRows.filter((row) => row.constructor && row.team_id == null).length;
  payload.unresolved.damageCosts = normalizedRows.filter((row) => row.cost_status !== "resolved").length;
  const hasUnresolved = Object.values(payload.unresolved).some((value) => Number(value || 0) > 0);
  if (hasUnresolved || !mapped.complete || payload.coverage.status !== "complete") payload.coverage.status = "incomplete";
  return payload;
}

function sourceHeaders(headers) {
  return {
    etag: headers?.get?.("etag") || null,
    lastModified: headers?.get?.("last-modified") || null,
    contentType: headers?.get?.("content-type") || null
  };
}

function buildDatabase(args) {
  const db = createAppDatabase({ databaseUrl: args.databaseUrl, sqlitePath: args.dbPath });
  if (db.dialect === "postgres") ensurePostgresSchema(db);
  ensureSeasonInputsSchema(db);
  ensureRaceDataSchema(db);
  ensureActualSnapshotColumns(db);
  ensurePublishedActualsSchema(db);
  return db;
}

function buildCatalog(db, season) {
  return buildSeasonCatalog(db, season, { questions: readQuestions() });
}

function derivePendingActual(db, { args, catalog, round, importId, evidenceId, roundName }) {
  const questions = readQuestions();
  if (!questions.length) return { snapshotId: null, values: {}, skipped: "questions_missing" };
  const base = catalog.drivers?.length && catalog.teams?.length && catalog.races?.length;
  if (!base) return { snapshotId: null, values: {}, skipped: "catalog_incomplete" };
  const roster = {
    drivers: catalog.drivers.map((driver) => String(driver.display_name_override || driver.display_name || "").trim()).filter(Boolean),
    teams: catalog.teams.map((team) => String(team.display_name_override || team.display_name || "").trim()).filter(Boolean)
  };
  const derived = deriveSnapshotsFromPersistedEvidence(db, {
    season: args.season,
    rounds: [round],
    questions,
    roster,
    races: catalog.races,
    totalRounds: catalog.races.length
  })[0];
  const snapshot = upsertSnapshotForRound(db, {
    season: args.season,
    roundNumber: round,
    roundName,
    valuesByQuestion: derived?.values || {},
    sourceType: SOURCE_TYPES.REDDIT_DESTRUCTORS,
    sourceNote: "Derived from persisted race evidence; Reddit Destructors source remains pending admin review.",
    label: `R${round} - ${roundName}`,
    reviewStatus: REVIEW_STATUS_PENDING,
    preserveReviewIfUnchanged: true,
    catalogRevision: catalog.catalogRevision || null,
    evidenceRevision: `reddit:${round}:${evidenceId}`,
    derivationVersion: `${PROVIDER_SCHEMA}-derivation-v1`
  });
  linkEvidenceToActualSnapshot(db, snapshot.snapshotId, evidenceId, importId);
  return { snapshotId: snapshot.snapshotId, values: derived?.values || {}, skipped: null };
}

async function run(args, { fetchImpl = globalThis.fetch, sleep } = {}) {
  let feed;
  try {
    feed = await fetchFeed({ feedUrl: args.feedUrl, fetchImpl, sleep });
  } catch (error) {
    if (Number(error?.statusCode) === 429) {
      return { status: "rate_limited", discovered: 0, imported: 0, skipped: 0, pending: 0, error: error.message };
    }
    throw error;
  }
  if (feed.status === "not_modified") return { status: "unchanged", discovered: 0, imported: 0, skipped: 0, pending: 0 };
  const db = args.apply ? buildDatabase(args) : createAppDatabase({ databaseUrl: args.databaseUrl, sqlitePath: args.dbPath });
  let catalog = null;
  let candidates;
  try {
    if (db) catalog = buildCatalog(db, args.season);
    const races = catalog?.races || [];
    candidates = selectCandidates(feed.entries, { author: args.author, season: args.season, races });
    if (args.round != null) candidates = candidates.filter((candidate) => Number(candidate.match.round) === args.round);
    const summary = { status: "ok", discovered: candidates.length, imported: 0, skipped: 0, pending: 0, incomplete: 0, rounds: [] };
    if (!args.apply) {
      summary.rounds = candidates.map((candidate) => {
        const map = mapDamageRows({ post: candidate, season: args.season, races, drivers: rosterForRound(catalog || { drivers: [], assignments: [], teams: [] }, candidate.match.round || 0).drivers });
        return { postId: candidate.id, title: candidate.title, round: map.round, roundName: map.roundName, rows: map.rows.length, complete: map.complete, warnings: map.warnings };
      });
      return summary;
    }
    const syncId = `reddit-destructors-${args.season}-${Date.now()}`;
    const importId = createRaceDataImport(db, {
      season: args.season,
      syncId,
      sourceType: SOURCE_TYPES.REDDIT_DESTRUCTORS,
      parserVersion: PROVIDER_SCHEMA,
      requestedRounds: candidates.length,
      sourceNote: `Reddit RSS ${args.feedUrl}`
    });
    const tx = db.transaction(() => {
      for (const candidate of candidates) {
        const mapped = mapDamageRows({
          post: candidate,
          season: args.season,
          races,
          drivers: rosterForRound(catalog, candidate.match.round || 0).drivers,
          teams: catalog.teams
        });
        const candidateHash = stableHash({ title: candidate.title, body: candidate.bodyText, url: candidate.url, updatedAt: candidate.updatedAt });
        const prior = findDestructorsSourcePost(db, PROVIDER, candidate.id);
        const sameContent = prior && prior.content_hash === candidateHash;
        if (sameContent) {
          summary.skipped += 1;
          continue;
        }
        const sourceStatus = !mapped.round ? "unmatched_round" : mapped.complete ? "ready_for_review" : "pending_review";
        const roster = rosterForRound(catalog, mapped.round || 0);
        const normalizedRows = mapped.rows.map((row) => normalizeDamageRow(row, roster.drivers.map((driver) => driver.display_name), catalog.canonical)).filter((row) => row.round != null && row.driver);
        const sourceId = saveDestructorsSourcePost(db, {
          provider: PROVIDER,
          postId: candidate.id,
          season: args.season,
          roundNumber: mapped.round,
          roundName: mapped.roundName,
          postUrl: candidate.url,
          author: candidate.author,
          title: candidate.title,
          publishedAt: candidate.publishedAt,
          updatedAt: candidate.updatedAt,
          fetchedAt: new Date().toISOString(),
          contentHash: candidateHash,
          bodyText: candidate.bodyText,
          bodyHtml: candidate.bodyHtml,
          imageUrls: candidate.imageUrls,
          parserVersion: PROVIDER_SCHEMA,
          status: sourceStatus,
          warnings: mapped.warnings,
          normalized: { ...mapped, rows: normalizedRows },
          headers: sourceHeaders(feed.headers)
        });
        if (!mapped.round) {
          summary.skipped += 1;
          continue;
        }
        const previousEvidence = findRaceDataSnapshot(db, args.season, mapped.round);
        const evidence = updateDamageEvidence(previousEvidence?.payload || null, {
          args,
          candidate,
          mapped,
          normalizedRows
        });
        const evidenceId = saveRaceDataSnapshot(db, {
          season: args.season,
          roundNumber: mapped.round,
          roundName: mapped.roundName,
          syncId: `${syncId}:${candidate.id}:${candidateHash.slice(0, 12)}`,
          importId,
          fetchedAt: new Date().toISOString(),
          sourceType: SOURCE_TYPES.REDDIT_DESTRUCTORS,
          sourceNote: `Reddit post ${candidate.url || candidate.id}; raw evidence preserved for review.`,
          parserVersion: PROVIDER_SCHEMA,
          calendarState: "completed",
          payloadRevision: candidateHash,
          evidence
        });
        const pending = derivePendingActual(db, {
          args,
          catalog,
          round: mapped.round,
          importId,
          evidenceId,
          roundName: mapped.roundName
        });
        summary.imported += 1;
        if (pending.snapshotId) summary.pending += 1;
        if (!mapped.complete) summary.incomplete += 1;
        summary.rounds.push({ postId: candidate.id, round: mapped.round, sourceId, evidenceId, pendingSnapshotId: pending.snapshotId, complete: mapped.complete, warnings: mapped.warnings });
      }
      completeRaceDataImport(db, importId, { status: "completed", completedRounds: summary.imported });
    });
    tx();
    return summary;
  } finally {
    if (db) db.close();
  }
}

async function main() {
  try {
    const result = await run(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  buildCatalog,
  mapDamageRows,
  parseArgs,
  run,
  updateDamageEvidence
};
