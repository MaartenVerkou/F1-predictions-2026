"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createAppDatabase } = require("../src/app-database");
const {
  SOURCE_TYPES,
  buildEvidenceBundle,
  completeRaceDataImport,
  createRaceDataImport,
  ensureRaceDataSchema,
  linkEvidenceToActualSnapshot,
  saveRaceDataSnapshot
} = require("../src/race-data-evidence");
const {
  ensureActualSnapshotColumns,
  ensurePublishedActualsSchema
} = require("../src/actuals-snapshots");
const roster = require("../data/roster.json");
const races = require("../data/races.json").races;
const { DRIVER_TEAM_ASSIGNMENTS, seedSeasonInputs } = require("./seed-season-inputs");
const { seedPreviewSeasonFixtures } = require("./seed-preview-season-fixtures");
const { listSeasonInputs, upsertDriver, upsertSeasonDriver } = require("../src/season-inputs");
const { buildSeasonCatalog } = require("../src/season-catalog");
const { applySeasonLineup, buildLineupProjection } = require("../src/season-lineup");

const PREVIEW_SOURCE = "preview_fixture";
const PREVIEW_SYNC_ID = "preview-race-audit-v2";
const PREVIEW_PARSER_VERSION = "preview-evidence-v1";
const SANITIZED_NOTE = "Sanitized WOK preview fixture; not production data";

function splitDriverName(name) {
  const parts = String(name).split(" ");
  return {
    givenName: parts.shift() || "",
    familyName: parts.join(" ")
  };
}

function buildRows(round, now, lineup = null) {
  const pointsByPosition = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  const entries = Array.isArray(lineup) && lineup.length
    ? lineup
    : roster.drivers.map((name) => ({ name, teamName: DRIVER_TEAM_ASSIGNMENTS[name] }));
  return entries.map((entry, index) => {
    const name = String(entry.name || "").trim();
    const teamName = String(entry.teamName || "").trim();
    if (!teamName) throw new Error(`Missing canonical preview team assignment for ${name}.`);
    const position = ((index + round * 2) % entries.length) + 1;
    const retired = round === 8 && index === 4;
    const dns = round === 13 && index === 17;
    const status = retired ? "Retired" : dns ? "Did not start" : "Finished";
    const visiblePosition = retired || dns ? "" : String(position);
    return {
      number: String(index + 1),
      position: visiblePosition,
      grid: String(((index * 3 + round) % 22) + 1),
      points: retired || dns ? "0" : String(pointsByPosition[position - 1] || 0),
      laps: retired ? "42" : "70",
      status,
      Driver: splitDriverName(name),
      Constructor: { name: teamName }
    };
  });
}

function buildEvidence(round, now, totals, canonicalCatalog = null, provenance = {}, lineup = null) {
  const roundName = races[round - 1] || "Round " + round;
  const cancelled = round === 10;
  const raceRows = cancelled ? [] : buildRows(round, now, lineup);
  const qualifyingRows = cancelled || round === 8
    ? []
    : raceRows.map((row) => ({ ...row, position: row.position || "20" }));
  const sprintRows = [6, 11].includes(round)
    ? raceRows.slice(0, 10).map((row, index) => ({ ...row, position: String(index + 1), points: String(Math.max(0, 8 - index)) }))
    : [];

  if (!cancelled) {
    raceRows.forEach((row) => {
      const driver = row.Driver.givenName + " " + row.Driver.familyName;
      const points = Number(row.points || 0);
      totals.drivers[driver] = (totals.drivers[driver] || 0) + points;
      const team = row.Constructor.name;
      totals.teams[team] = (totals.teams[team] || 0) + points;
      if (sprintRows.length) {
        const sprint = sprintRows.find((item) => item.Driver.givenName + " " + item.Driver.familyName === driver);
        const sprintPoints = Number(sprint?.points || 0);
        totals.drivers[driver] += sprintPoints;
        totals.teams[team] += sprintPoints;
      }
    });
  }

  const standingDriverNames = Array.from(new Set([
    ...roster.drivers,
    ...Object.keys(totals.drivers)
  ]));
  const driverStandings = standingDriverNames
    .map((name) => ({ name, points: totals.drivers[name] || 0 }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .map((item, index) => ({
      position: String(index + 1),
      points: String(item.points),
      Driver: splitDriverName(item.name)
    }));
  const constructorStandings = roster.teams
    .map((name) => ({ name, points: totals.teams[name] || 0 }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .map((item, index) => ({
      position: String(index + 1),
      points: String(item.points),
      Constructor: { name: item.name }
    }));

  return {
    roundName,
    calendarState: cancelled ? "cancelled" : round === 8 ? "partial" : "completed",
    evidence: buildEvidenceBundle({
      data: {
        season: 2026,
        results: cancelled ? [] : [{
          round,
          raceName: roundName,
          date: "2026-01-" + String(10 + round).padStart(2, "0"),
          Circuit: { circuitName: "Sanitized Circuit " + round },
          Results: raceRows
        }],
        qualifying: qualifyingRows.length ? [{ round, QualifyingResults: qualifyingRows }] : [],
        sprints: sprintRows.length ? [{ round, SprintResults: sprintRows }] : [],
        driverStandingsByRound: new Map([[round, driverStandings]]),
        constructorStandingsByRound: new Map([[round, constructorStandings]]),
        driverOfTheDayByRound: new Map([[round, roster.drivers[(round - 1) % roster.drivers.length]]])
      },
      roster,
      canonicalCatalog,
      catalogRevision: provenance.catalogRevision || null,
      cutoffRound: round,
      sourceIdentity: provenance.sourceIdentity || null,
      payloadRevision: provenance.payloadRevision || null,
      roundNumber: round,
      roundName,
      fetchedAt: now,
      sourceUrls: {
        race: "preview://sanitized/r" + round + "/results",
        qualifying: qualifyingRows.length ? "preview://sanitized/r" + round + "/qualifying" : null,
        sprint: sprintRows.length ? "preview://sanitized/r" + round + "/sprint" : null,
        driverStandings: "preview://sanitized/r" + round + "/driver-standings",
        constructorStandings: "preview://sanitized/r" + round + "/constructor-standings"
      }
    })
  };
}

function seedPreviewReplacement(database, now) {
  const catalog = listSeasonInputs(database, 2026);
  if (!catalog.season) throw new Error("Preview season inputs were not seeded.");
  const replacementId = upsertDriver(database, {
    slug: "preview-replacement-driver",
    displayName: "Preview Replacement",
    now
  });
  upsertSeasonDriver(database, {
    seasonId: catalog.season.id,
    driverId: replacementId,
    driverNumber: "99",
    now
  });
  const projection = buildLineupProjection({
    teams: catalog.teams,
    drivers: catalog.drivers,
    assignments: catalog.assignments,
    roundNumber: 1
  });
  const targetTeam = projection.find((team) => team.teamName === "Mercedes") || projection[0];
  if (!targetTeam) throw new Error("Preview fixture has no target team.");
  const desiredSeats = projection.flatMap((team) => team.seats.map((seat) => ({
    teamId: team.teamId,
    seatNumber: seat.seatNumber,
    driverId: team.teamId === targetTeam.teamId && seat.seatNumber === 2 ? replacementId : seat.driverId
  })));
  applySeasonLineup(database, {
    seasonId: catalog.season.id,
    roundNumber: 8,
    desiredSeats,
    source: PREVIEW_SOURCE,
    now,
    historicalCorrectionConfirmed: true
  });
  return { driverId: replacementId, teamId: targetTeam.teamId, fromRound: 8 };
}

function buildPreviewLineupEntries(seasonCatalog, round) {
  const projection = buildLineupProjection({
    teams: seasonCatalog.teams,
    drivers: seasonCatalog.drivers,
    assignments: seasonCatalog.assignments,
    roundNumber: round
  });
  const active = projection.flatMap((team) => team.seats
    .filter((seat) => seat.driverId != null && seat.driverName)
    .map((seat) => ({ name: seat.driverName, teamName: team.teamName })));
  const activeByName = new Map(active.map((entry) => [entry.name, entry]));
  const rosterNames = new Set(roster.drivers);
  const replacements = active.filter((entry) => !rosterNames.has(entry.name));
  let replacementIndex = 0;
  const entries = roster.drivers.flatMap((name) => {
    const entry = activeByName.get(name);
    if (entry) return [entry];
    const replacement = replacements[replacementIndex];
    replacementIndex += 1;
    return replacement ? [replacement] : [];
  });
  return entries.concat(replacements.slice(replacementIndex));
}

/**
 * Keep the deterministic fixture available for unit tests and local UI tests.
 * It is deliberately not used by the public preview lifecycle anymore.
 */
function seedFixturePreview(database, now = new Date().toISOString()) {
  if (String(process.env.WOK_PREVIEW_DATA_MODE || "").trim().toLowerCase() !== "sanitized") {
    throw new Error("Preview fixture seeding requires WOK_PREVIEW_DATA_MODE=sanitized");
  }
  if (!String(process.env.DATABASE_URL || "").trim()) {
    throw new Error("Preview fixture seeding requires DATABASE_URL");
  }

  ensureRaceDataSchema(database);
  ensureActualSnapshotColumns(database);
  ensurePublishedActualsSchema(database);
  seedSeasonInputs(database, { season: 2026, now });
  const replacement = seedPreviewReplacement(database, now);
  const seasonCatalog = buildSeasonCatalog(database, 2026);
  const canonicalCatalog = seasonCatalog.canonical;
  const lineupByRound = new Map(
    Array.from({ length: 14 }, (_, index) => index + 1)
      .map((round) => [round, buildPreviewLineupEntries(seasonCatalog, round)])
  );
  const transaction = database.transaction(() => {
    // A sanitized preview is its own dataset. Remove stale provider evidence first
    // so the audit route cannot select an older non-sanitized snapshot for a round.
    database.prepare("DELETE FROM actual_snapshot_values WHERE snapshot_id IN (SELECT id FROM actual_snapshots WHERE season = ?)").run(2026);
    database.prepare("DELETE FROM actual_snapshots WHERE season = ?").run(2026);
    database.prepare("DELETE FROM race_data_snapshots WHERE season = ?").run(2026);
    database.prepare("DELETE FROM race_data_imports WHERE season = ?").run(2026);

    const importId = createRaceDataImport(database, {
      season: 2026,
      syncId: PREVIEW_SYNC_ID,
      sourceType: PREVIEW_SOURCE,
      parserVersion: PREVIEW_PARSER_VERSION,
      requestedRounds: 14,
      reconstructed: false,
      sourceNote: SANITIZED_NOTE,
      startedAt: now
    });
    const totals = { drivers: {}, teams: {} };
    const snapshots = [];
    for (let round = 1; round <= 14; round += 1) {
      const built = buildEvidence(round, now, totals, canonicalCatalog, {
        catalogRevision: seasonCatalog.catalogRevision,
        sourceIdentity: PREVIEW_SYNC_ID + ":r" + round,
        payloadRevision: PREVIEW_PARSER_VERSION + ":" + round
      }, lineupByRound.get(round));
      const evidenceId = saveRaceDataSnapshot(database, {
        season: 2026,
        roundNumber: round,
        roundName: built.roundName,
        syncId: PREVIEW_SYNC_ID,
        importId,
        fetchedAt: now,
        sourceType: PREVIEW_SOURCE,
        sourceNote: SANITIZED_NOTE,
        parserVersion: PREVIEW_PARSER_VERSION,
        calendarState: built.calendarState,
        reconstructed: false,
        catalogRevision: seasonCatalog.catalogRevision,
        sourceIdentity: PREVIEW_SYNC_ID + ":r" + round,
        payloadRevision: PREVIEW_PARSER_VERSION + ":" + round,
        cutoffRound: round,
        evidence: built.evidence
      });
      const snapshotId = Number(database.prepare(
        "INSERT INTO actual_snapshots (season, round_number, round_name, label, source_type, source_note, created_at, updated_at, created_by_user_id, review_status, reviewed_at, reviewed_by_user_id, catalog_revision, evidence_revision, derivation_version, published_at, manual_correction_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL, NULL, ?, ?, ?, NULL, NULL)"
      ).run(
        2026, round, built.roundName, "R" + round + " - " + built.roundName,
        PREVIEW_SOURCE, SANITIZED_NOTE, now, now,
        seasonCatalog.catalogRevision,
        PREVIEW_PARSER_VERSION + ":" + round,
        "preview-fixture-v1"
      ).lastInsertRowid);
      linkEvidenceToActualSnapshot(database, snapshotId, evidenceId, importId);
      const value = built.calendarState === "cancelled" ? "no" : "yes";
      database.prepare(
        "INSERT INTO actual_snapshot_values (snapshot_id, question_id, value) VALUES (?, ?, ?)"
      ).run(snapshotId, "all_teams_score_points", value);
      snapshots.push({ round, snapshotId, evidenceId, calendarState: built.calendarState });
    }
    completeRaceDataImport(database, importId, {
      status: "completed",
      completedRounds: snapshots.length,
      completedAt: now
    });
    return { importId, snapshots };
  });
  const result = transaction();
  const seasons = seedPreviewSeasonFixtures(database);
  return {
    sourceType: PREVIEW_SOURCE,
    importId: result.importId,
    snapshotCount: result.snapshots.length,
    rounds: result.snapshots.map((item) => item.round),
    sanitized: true,
    replacement,
    seasons
  };
}

function clearPreviewEvidence(database, season = 2026) {
  const transaction = database.transaction(() => {
    database.prepare(
      "DELETE FROM actual_snapshot_values WHERE snapshot_id IN (SELECT id FROM actual_snapshots WHERE season = ?)"
    ).run(Number(season));
    database.prepare("DELETE FROM actual_snapshots WHERE season = ?").run(Number(season));
    database.prepare("DELETE FROM race_data_snapshots WHERE season = ?").run(Number(season));
    database.prepare("DELETE FROM race_data_imports WHERE season = ?").run(Number(season));
    // The legacy projection is intentionally empty until an admin publishes a
    // reviewed snapshot. The preview database is isolated and may be reset.
    database.prepare("DELETE FROM actuals").run();

    // Remove only the old fixture-only current-season replacement. The
    // canonical roster and real provider data must never contain this entity.
    const stale = database.prepare(
      "SELECT id FROM drivers WHERE slug = 'preview-replacement-driver'"
    ).all().map((row) => Number(row.id));
    if (stale.length > 0) {
      const placeholders = stale.map(() => "?").join(",");
      database.prepare(`DELETE FROM driver_team_assignments WHERE driver_id IN (${placeholders})`).run(...stale);
      database.prepare(`DELETE FROM season_drivers WHERE driver_id IN (${placeholders})`).run(...stale);
      database.prepare(`DELETE FROM entity_aliases WHERE entity_type = 'driver' AND entity_id IN (${placeholders})`).run(...stale);
      database.prepare(`DELETE FROM entity_provider_refs WHERE entity_type = 'driver' AND entity_id IN (${placeholders})`).run(...stale);
      database.prepare(`DELETE FROM drivers WHERE id IN (${placeholders})`).run(...stale);
    }
  });
  transaction();
}

function prepareProviderPreview(database, {
  season = 2026,
  now = new Date().toISOString()
} = {}) {
  ensureRaceDataSchema(database);
  ensureActualSnapshotColumns(database);
  ensurePublishedActualsSchema(database);
  const seeded = seedSeasonInputs(database, { season, now });
  clearPreviewEvidence(database, season);
  return seeded;
}

function runProviderBackfill({
  season = 2026,
  maxRound = null,
  spawn = spawnSync
} = {}) {
  const args = [
    path.join(__dirname, "backfill-actuals-2026.js"),
    "--apply",
    `--season=${Number(season)}`
  ];
  if (maxRound != null) args.push(`--max-round=${Number(maxRound)}`);
  const result = spawn(process.execPath, args, {
    encoding: "utf8",
    env: { ...process.env },
    maxBuffer: 50 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(
      String(result.stderr || result.stdout || `Provider backfill failed for season ${season}`).trim()
    );
  }
  let details = {};
  try {
    details = JSON.parse(String(result.stdout || "").trim());
  } catch (_error) {
    throw new Error("Provider backfill completed without a machine-readable result.");
  }
  return details;
}

function summarizeProviderPreview(database, {
  season = 2026,
  seasons = [],
  backfill = {}
} = {}) {
  const importRow = database.prepare(
    "SELECT id, sync_id, source_type, parser_version, requested_rounds, completed_rounds, status FROM race_data_imports WHERE season = ? ORDER BY id DESC LIMIT 1"
  ).get(Number(season));
  const snapshots = database.prepare(
    "SELECT round_number, round_name, coverage_status, unresolved_count FROM race_data_snapshots WHERE season = ? ORDER BY round_number"
  ).all(Number(season));
  return {
    sourceType: importRow?.source_type || SOURCE_TYPES.OPENF1,
    sourceNote: "Provider-backed preview evidence; isolated from production",
    importId: importRow ? Number(importRow.id) : null,
    import: importRow || null,
    snapshotCount: snapshots.length,
    rounds: snapshots.map((row) => Number(row.round_number)),
    incompleteRounds: snapshots
      .filter((row) => row.coverage_status !== "complete" || Number(row.unresolved_count || 0) > 0)
      .map((row) => ({
        round: Number(row.round_number),
        name: row.round_name,
        coverage: row.coverage_status,
        unresolved: Number(row.unresolved_count || 0)
      })),
    backfill: {
      latestRound: backfill.latestRound || null,
      changedSnapshotCount: Number(backfill.changedSnapshotCount || 0),
      comparison: backfill.comparison || null
    },
    seasons
  };
}

function seedProviderPreview({
  databaseUrl = String(process.env.DATABASE_URL || ""),
  sqlitePath = process.env.DB_PATH,
  season = 2026,
  now = new Date().toISOString(),
  runBackfill = runProviderBackfill
} = {}) {
  if (!databaseUrl.trim() && !sqlitePath) {
    throw new Error("Provider preview seeding requires DATABASE_URL or DB_PATH");
  }

  const database = createAppDatabase({ databaseUrl, sqlitePath });
  try {
    prepareProviderPreview(database, { season, now });
  } finally {
    database.close?.();
  }

  const backfill = runBackfill({ season });
  const finalized = createAppDatabase({ databaseUrl, sqlitePath });
  try {
    const seasons = seedPreviewSeasonFixtures(finalized);
    return summarizeProviderPreview(finalized, { season, seasons, backfill });
  } finally {
    finalized.close?.();
  }
}

function main() {
  console.log(JSON.stringify(seedProviderPreview({
    databaseUrl: String(process.env.DATABASE_URL || ""),
    sqlitePath: process.env.DB_PATH
  })));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

// Backwards-compatible fixture export for focused unit tests. The CLI above
// always uses provider-backed evidence and never calls this fixture path.
const seedSanitizedPreview = seedFixturePreview;

module.exports = {
  buildEvidence,
  clearPreviewEvidence,
  prepareProviderPreview,
  runProviderBackfill,
  seedFixturePreview,
  seedProviderPreview,
  seedSanitizedPreview,
  summarizeProviderPreview
};
