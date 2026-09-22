"use strict";

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
const roster = require("../data/roster.json");
const races = require("../data/races.json").races;
const { DRIVER_TEAM_ASSIGNMENTS, seedSeasonInputs } = require("./seed-season-inputs");
const { listSeasonInputs, upsertDriver, upsertSeasonDriver } = require("../src/season-inputs");
const { buildCanonicalCatalog } = require("../src/canonical-answers");
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

function buildRows(round, now) {
  const pointsByPosition = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  return roster.drivers.map((name, index) => {
    const teamName = DRIVER_TEAM_ASSIGNMENTS[name];
    if (!teamName) throw new Error(`Missing canonical preview team assignment for ${name}.`);
    const position = ((index + round * 2) % roster.drivers.length) + 1;
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

function buildEvidence(round, now, totals, canonicalCatalog = null) {
  const roundName = races[round - 1] || "Round " + round;
  const cancelled = round === 10;
  const raceRows = cancelled ? [] : buildRows(round, now);
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

  const driverStandings = roster.drivers
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

function seedSanitizedPreview(database, now = new Date().toISOString()) {
  if (String(process.env.WOK_PREVIEW_DATA_MODE || "").trim().toLowerCase() !== "sanitized") {
    throw new Error("Preview fixture seeding requires WOK_PREVIEW_DATA_MODE=sanitized");
  }
  if (!String(process.env.DATABASE_URL || "").trim()) {
    throw new Error("Preview fixture seeding requires DATABASE_URL");
  }

  ensureRaceDataSchema(database);
  seedSeasonInputs(database, { season: 2026, now });
  const replacement = seedPreviewReplacement(database, now);
  const canonicalCatalog = buildCanonicalCatalog(listSeasonInputs(database, 2026));
  const transaction = database.transaction(() => {
    database.prepare("DELETE FROM actual_snapshot_values WHERE snapshot_id IN (SELECT id FROM actual_snapshots WHERE source_type = ?)").run(PREVIEW_SOURCE);
    database.prepare("DELETE FROM actual_snapshots WHERE source_type = ?").run(PREVIEW_SOURCE);
    database.prepare("DELETE FROM race_data_snapshots WHERE source_type = ?").run(PREVIEW_SOURCE);
    database.prepare("DELETE FROM race_data_imports WHERE source_type = ?").run(PREVIEW_SOURCE);

    const importId = createRaceDataImport(database, {
      season: 2026,
      syncId: PREVIEW_SYNC_ID,
      sourceType: PREVIEW_SOURCE,
      parserVersion: PREVIEW_PARSER_VERSION,
      requestedRounds: 13,
      reconstructed: false,
      sourceNote: SANITIZED_NOTE,
      startedAt: now
    });
    const totals = { drivers: {}, teams: {} };
    const snapshots = [];
    for (let round = 1; round <= 13; round += 1) {
      const built = buildEvidence(round, now, totals, canonicalCatalog);
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
        evidence: built.evidence
      });
      const snapshotId = Number(database.prepare(
        "INSERT INTO actual_snapshots (season, round_number, round_name, label, source_type, source_note, created_at, updated_at, created_by_user_id, review_status, reviewed_at, reviewed_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL, NULL)"
      ).run(
        2026, round, built.roundName, "R" + round + " - " + built.roundName,
        PREVIEW_SOURCE, SANITIZED_NOTE, now, now
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
    database.prepare(
      "INSERT INTO actuals (question_id, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(question_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    ).run("all_teams_score_points", "yes", now);
    return { importId, snapshots };
  });
  const result = transaction();
  return {
    sourceType: PREVIEW_SOURCE,
    importId: result.importId,
    snapshotCount: result.snapshots.length,
    rounds: result.snapshots.map((item) => item.round),
    sanitized: true,
    replacement
  };
}

function main() {
  const database = createAppDatabase({ databaseUrl: process.env.DATABASE_URL });
  try {
    console.log(JSON.stringify(seedSanitizedPreview(database)));
  } finally {
    database.close();
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = { seedSanitizedPreview, buildEvidence };
