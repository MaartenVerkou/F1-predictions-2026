"use strict";

const { createAppDatabase } = require("../src/app-database");
const {
  SOURCE_TYPES,
  buildEvidenceBundle,
  ensureRaceDataSchema,
  linkEvidenceToActualSnapshot,
  saveRaceDataSnapshot
} = require("../src/race-data-evidence");
const roster = require("../data/roster.json");

const PREVIEW_SOURCE = "preview_fixture";
const PREVIEW_ROUND = 6;
const PREVIEW_VALUE = "yes";
const PREVIEW_SYNC_ID = "preview-fixture-r6-v1";

function splitDriverName(name) {
  const parts = String(name).split(" ");
  return {
    givenName: parts.shift() || "",
    familyName: parts.join(" ")
  };
}

function buildPreviewEvidence(now) {
  const drivers = roster.drivers.slice(0, 6);
  const teams = roster.teams.slice(0, 3);
  const points = [25, 18, 15, 12, 10, 8];
  const results = drivers.map((name, index) => ({
    number: String(1 + index),
    position: String(index + 1),
    grid: index + 1,
    points: String(points[index]),
    laps: 78,
    status: "Finished",
    Driver: splitDriverName(name),
    Constructor: { name: teams[index % teams.length] }
  }));
  const qualifyingResults = drivers.map((name, index) => ({
    number: String(1 + index),
    position: String(index + 1),
    points: "0",
    Driver: splitDriverName(name),
    Constructor: { name: teams[index % teams.length] }
  }));
  const standings = drivers.map((name, index) => ({
    position: String(index + 1),
    points: String(points[index]),
    Driver: splitDriverName(name)
  }));
  const constructorStandings = teams.map((name, index) => ({
    position: String(index + 1),
    points: String(points
      .filter((_, driverIndex) => driverIndex % teams.length === index)
      .reduce((sum, value) => sum + value, 0)),
    Constructor: { name }
  }));
  return buildEvidenceBundle({
    data: {
      season: 2026,
      results: [{
        round: PREVIEW_ROUND,
        raceName: "Monaco Grand Prix",
        date: "2026-05-24",
        Circuit: { circuitName: "Circuit de Monaco" },
        Results: results
      }],
      qualifying: [{
        round: PREVIEW_ROUND,
        QualifyingResults: qualifyingResults
      }],
      sprints: [],
      driverStandingsByRound: new Map([[PREVIEW_ROUND, standings]]),
      constructorStandingsByRound: new Map([[PREVIEW_ROUND, constructorStandings]]),
      driverOfTheDayByRound: new Map()
    },
    roster,
    roundNumber: PREVIEW_ROUND,
    roundName: "Monaco Grand Prix",
    fetchedAt: now,
    sourceUrls: {
      race: "preview://sanitized/r6/results",
      qualifying: "preview://sanitized/r6/qualifying",
      driverStandings: "preview://sanitized/r6/driver-standings",
      constructorStandings: "preview://sanitized/r6/constructor-standings"
    }
  });
}

function seedSanitizedPreview(database, now = new Date().toISOString()) {
  if (String(process.env.WOK_PREVIEW_DATA_MODE || "").trim().toLowerCase() !== "sanitized") {
    throw new Error("Preview fixture seeding requires WOK_PREVIEW_DATA_MODE=sanitized");
  }
  if (!String(process.env.DATABASE_URL || "").trim()) {
    throw new Error("Preview fixture seeding requires DATABASE_URL");
  }

  ensureRaceDataSchema(database);
  const evidence = buildPreviewEvidence(now);
  const existing = database
    .prepare(
      "SELECT id FROM actual_snapshots WHERE season = ? AND round_number = ? AND source_type = ? ORDER BY id DESC"
    )
    .get(2026, PREVIEW_ROUND, PREVIEW_SOURCE);

  const transaction = database.transaction(() => {
    const snapshotId = existing
      ? Number(existing.id)
      : Number(
          database
            .prepare(
              `
              INSERT INTO actual_snapshots (
                season, round_number, round_name, label, source_type, source_note,
                created_at, updated_at, created_by_user_id, review_status,
                reviewed_at, reviewed_by_user_id
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL, NULL)
              `
            )
            .run(
              2026,
              PREVIEW_ROUND,
              "Monaco Grand Prix",
              "R6 - Monaco Grand Prix",
              PREVIEW_SOURCE,
              "Sanitized WOK preview fixture",
              now,
              now
            ).lastInsertRowid
        );

    const evidenceId = saveRaceDataSnapshot(database, {
      season: 2026,
      roundNumber: PREVIEW_ROUND,
      roundName: "Monaco Grand Prix",
      syncId: PREVIEW_SYNC_ID,
      fetchedAt: now,
      sourceType: SOURCE_TYPES.JOLPICA,
      sourceNote: "Sanitized WOK preview fixture; not production data",
      evidence
    });
    linkEvidenceToActualSnapshot(database, snapshotId, evidenceId);

    database
      .prepare(
        `
        INSERT INTO actual_snapshot_values (snapshot_id, question_id, value)
        VALUES (?, ?, ?)
        ON CONFLICT(snapshot_id, question_id) DO UPDATE SET value = excluded.value
        `
      )
      .run(snapshotId, "all_teams_score_points", PREVIEW_VALUE);

    database
      .prepare(
        `
        INSERT INTO actuals (question_id, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(question_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `
      )
      .run("all_teams_score_points", PREVIEW_VALUE, now);

    return { snapshotId, evidenceId };
  });

  const result = transaction();
  return {
    sourceType: PREVIEW_SOURCE,
    snapshotId: result.snapshotId,
    evidenceId: result.evidenceId,
    roundNumber: PREVIEW_ROUND,
    seededQuestionIds: ["all_teams_score_points"],
    sanitized: true
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

module.exports = { seedSanitizedPreview, buildPreviewEvidence };
