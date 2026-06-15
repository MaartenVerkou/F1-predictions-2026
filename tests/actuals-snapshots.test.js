"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const Database = require("better-sqlite3");
const {
  REVIEW_STATUS_PENDING,
  REVIEW_STATUS_REVIEWED,
  ensureActualSnapshotColumns,
  findLatestSnapshotForRound,
  upsertSnapshotForRound
} = require("../src/actuals-snapshots");

function createTempDb() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "f1-actual-snapshots-"));
  const dbPath = path.join(tempDir, "app.db");
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE actual_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season INTEGER NOT NULL,
      round_number INTEGER,
      round_name TEXT,
      label TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_note TEXT,
      created_at TEXT NOT NULL,
      created_by_user_id INTEGER
    );

    CREATE TABLE actual_snapshot_values (
      snapshot_id INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY(snapshot_id, question_id)
    );
  `);
  return { db, tempDir };
}

test("ensureActualSnapshotColumns backfills review metadata for existing rows", (t) => {
  const { db, tempDir } = createTempDb();
  t.after(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  db.prepare(
    `
    INSERT INTO actual_snapshots (
      season, round_number, round_name, label, source_type, source_note, created_at, created_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(2026, 4, "Miami Grand Prix", "R4 - Miami Grand Prix", "manual", null, "2026-04-10T12:00:00.000Z", 7);

  ensureActualSnapshotColumns(db);

  const row = db.prepare(
    `
    SELECT updated_at, review_status, reviewed_at, reviewed_by_user_id
    FROM actual_snapshots
    LIMIT 1
    `
  ).get();

  assert.equal(row.updated_at, "2026-04-10T12:00:00.000Z");
  assert.equal(row.review_status, REVIEW_STATUS_REVIEWED);
  assert.equal(row.reviewed_at, "2026-04-10T12:00:00.000Z");
  assert.equal(row.reviewed_by_user_id, 7);
});

test("automatic snapshot updates preserve reviewed status until values change", (t) => {
  const { db, tempDir } = createTempDb();
  t.after(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  ensureActualSnapshotColumns(db);

  const manualResult = upsertSnapshotForRound(db, {
    season: 2026,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    valuesByQuestion: {
      q1: "A",
      q2: "B"
    },
    sourceType: "manual",
    createdByUserId: 11,
    label: "R6 - Monaco Grand Prix",
    reviewStatus: REVIEW_STATUS_REVIEWED
  });
  assert.ok(manualResult?.snapshotId);
  assert.equal(manualResult.reviewStatus, REVIEW_STATUS_REVIEWED);
  assert.equal(manualResult.valuesChanged, true);

  const unchangedAutoResult = upsertSnapshotForRound(db, {
    season: 2026,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    valuesByQuestion: {
      q1: "A",
      q2: "B"
    },
    sourceType: "autofill_backfill",
    sourceNote: "automatic sync",
    label: "R6 - Monaco Grand Prix",
    reviewStatus: REVIEW_STATUS_PENDING,
    preserveReviewIfUnchanged: true
  });
  assert.equal(unchangedAutoResult.snapshotId, manualResult.snapshotId);
  assert.equal(unchangedAutoResult.valuesChanged, false);
  assert.equal(unchangedAutoResult.reviewStatus, REVIEW_STATUS_REVIEWED);

  let snapshot = findLatestSnapshotForRound(db, 2026, 6);
  assert.equal(snapshot.review_status, REVIEW_STATUS_REVIEWED);
  assert.equal(snapshot.reviewed_by_user_id, 11);

  const changedAutoResult = upsertSnapshotForRound(db, {
    season: 2026,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    valuesByQuestion: {
      q1: "A",
      q2: "C"
    },
    sourceType: "autofill_backfill",
    sourceNote: "automatic sync",
    label: "R6 - Monaco Grand Prix",
    reviewStatus: REVIEW_STATUS_PENDING,
    preserveReviewIfUnchanged: true
  });
  assert.notEqual(changedAutoResult.snapshotId, manualResult.snapshotId);
  assert.equal(changedAutoResult.valuesChanged, true);
  assert.equal(changedAutoResult.reviewStatus, REVIEW_STATUS_PENDING);

  snapshot = findLatestSnapshotForRound(db, 2026, 6);
  assert.equal(snapshot.review_status, REVIEW_STATUS_PENDING);
  assert.equal(snapshot.reviewed_at, null);
  assert.equal(snapshot.reviewed_by_user_id, null);
});
