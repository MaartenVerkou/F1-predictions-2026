"use strict";

const { createAppDatabase } = require("../src/app-database");

const PREVIEW_SOURCE = "preview_fixture";
const PREVIEW_ROUND = 6;
const PREVIEW_VALUE = "yes";

function seedSanitizedPreview(database, now = new Date().toISOString()) {
  if (String(process.env.WOK_PREVIEW_DATA_MODE || "").trim().toLowerCase() !== "sanitized") {
    throw new Error("Preview fixture seeding requires WOK_PREVIEW_DATA_MODE=sanitized");
  }
  if (!String(process.env.DATABASE_URL || "").trim()) {
    throw new Error("Preview fixture seeding requires DATABASE_URL");
  }

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

    return snapshotId;
  });

  const snapshotId = transaction();
  return {
    sourceType: PREVIEW_SOURCE,
    snapshotId,
    roundNumber: PREVIEW_ROUND,
    seededQuestionIds: ["all_teams_score_points"]
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

module.exports = { seedSanitizedPreview };
