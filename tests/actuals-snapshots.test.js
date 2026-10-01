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
  ensurePublishedActualsSchema,
  findLatestRoundSnapshotForSeason,
  findLatestSnapshotForRound,
  loadPublishedActuals,
  findSnapshotById,
  listLatestSnapshotsForSeason,
  publishActualSnapshot,
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
  ensurePublishedActualsSchema(db);

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

test("round-limited snapshot lookups ignore stale debug rounds", (t) => {
  const { db, tempDir } = createTempDb();
  t.after(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  ensureActualSnapshotColumns(db);
  const validSnapshot = upsertSnapshotForRound(db, {
    season: 2026,
    roundNumber: 7,
    roundName: "Barcelona-Catalunya Grand Prix",
    valuesByQuestion: { q1: "A" },
    sourceType: "autofill_backfill",
    sourceNote: "automatic sync",
    label: "R7 - Barcelona-Catalunya Grand Prix",
    reviewStatus: REVIEW_STATUS_PENDING
  });
  const debugSnapshot = upsertSnapshotForRound(db, {
    season: 2026,
    roundNumber: 66,
    roundName: "Debug Grand Prix",
    valuesByQuestion: { q1: "B" },
    sourceType: "autofill_backfill",
    sourceNote: "debug",
    label: "R66 - Debug Grand Prix",
    reviewStatus: REVIEW_STATUS_PENDING
  });

  const options = { maxRoundNumber: 24 };
  const latest = findLatestRoundSnapshotForSeason(db, 2026, options);
  assert.equal(latest.id, validSnapshot.snapshotId);
  assert.equal(latest.round_number, 7);

  const snapshots = listLatestSnapshotsForSeason(db, 2026, options);
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.round_number),
    [7]
  );

  assert.equal(findSnapshotById(db, debugSnapshot.snapshotId, options), null);
  assert.equal(findSnapshotById(db, debugSnapshot.snapshotId).round_number, 66);
});

test("actual snapshots keep catalog and evidence provenance in the review lifecycle", (t) => {
  const { db, tempDir } = createTempDb();
  t.after(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  ensureActualSnapshotColumns(db);
  const first = upsertSnapshotForRound(db, {
    season: 2026,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    valuesByQuestion: { q1: "driver:1" },
    sourceType: "derived",
    catalogRevision: "catalog-a",
    evidenceRevision: "evidence-a",
    derivationVersion: "actuals-v1",
    reviewStatus: REVIEW_STATUS_PENDING
  });
  const second = upsertSnapshotForRound(db, {
    season: 2026,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    valuesByQuestion: { q1: "driver:1" },
    sourceType: "derived",
    catalogRevision: "catalog-b",
    evidenceRevision: "evidence-a",
    derivationVersion: "actuals-v1",
    reviewStatus: REVIEW_STATUS_PENDING,
    preserveReviewIfUnchanged: true
  });

  assert.notEqual(second.snapshotId, first.snapshotId);
  assert.equal(second.valuesChanged, false);
  assert.equal(second.provenanceChanged, true);
  const latest = findLatestSnapshotForRound(db, 2026, 6);
  assert.equal(latest.catalog_revision, "catalog-b");
  assert.equal(latest.evidence_revision, "evidence-a");
  assert.equal(latest.published_at, null);
});

test("a changed evidence derivation stays pending while published scoring remains on the prior revision", (t) => {
  const { db, tempDir } = createTempDb();
  t.after(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  ensureActualSnapshotColumns(db);
  ensurePublishedActualsSchema(db);
  const published = upsertSnapshotForRound(db, {
    season: 2026,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    valuesByQuestion: { q1: "driver:1" },
    sourceType: "race_data_derivation",
    evidenceRevision: "evidence-base",
    reviewStatus: REVIEW_STATUS_REVIEWED
  });
  publishActualSnapshot(db, { season: 2026, snapshotId: published.snapshotId, publishedByUserId: 7 });

  const corrected = upsertSnapshotForRound(db, {
    season: 2026,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    valuesByQuestion: { q1: "driver:2" },
    sourceType: "race_data_derivation",
    evidenceRevision: "evidence-correction",
    reviewStatus: REVIEW_STATUS_PENDING,
    preserveReviewIfUnchanged: true
  });
  assert.notEqual(corrected.snapshotId, published.snapshotId);
  assert.equal(corrected.reviewStatus, REVIEW_STATUS_PENDING);
  assert.deepEqual(loadPublishedActuals(db, 2026).values, { q1: "driver:1" });
});

test("published actuals are unavailable until an explicit reviewed snapshot is published", (t) => {
  const { db, tempDir } = createTempDb();
  t.after(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  ensureActualSnapshotColumns(db);
  ensurePublishedActualsSchema(db);
  const pending = upsertSnapshotForRound(db, {
    season: 2026,
    roundNumber: 1,
    roundName: "Australian Grand Prix",
    valuesByQuestion: { q1: "driver:1" },
    reviewStatus: REVIEW_STATUS_PENDING
  });
  assert.equal(loadPublishedActuals(db, 2026).available, false);
  assert.throws(
    () => publishActualSnapshot(db, { season: 2026, snapshotId: pending.snapshotId }),
    /reviewed actual snapshot/
  );

  const reviewed = upsertSnapshotForRound(db, {
    season: 2026,
    roundNumber: 1,
    roundName: "Australian Grand Prix",
    valuesByQuestion: { q1: "driver:2", q2: "25" },
    reviewStatus: REVIEW_STATUS_REVIEWED,
    createdByUserId: 9
  });
  const published = publishActualSnapshot(db, {
    season: 2026,
    snapshotId: reviewed.snapshotId,
    publishedByUserId: 9,
    publishedAt: "2026-04-01T12:00:00.000Z"
  });
  assert.equal(published.available, true);
  assert.equal(published.snapshot.id, reviewed.snapshotId);
  assert.deepEqual(published.values, { q1: "driver:2", q2: "25" });
});

test("publishing a newer snapshot is season-scoped and replaces only that season's pointer", (t) => {
  const { db, tempDir } = createTempDb();
  t.after(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  ensureActualSnapshotColumns(db);
  ensurePublishedActualsSchema(db);
  const first = upsertSnapshotForRound(db, {
    season: 2026,
    roundNumber: 2,
    valuesByQuestion: { q1: "old" },
    reviewStatus: REVIEW_STATUS_REVIEWED
  });
  const second = upsertSnapshotForRound(db, {
    season: 2026,
    roundNumber: 3,
    valuesByQuestion: { q1: "new" },
    reviewStatus: REVIEW_STATUS_REVIEWED
  });
  const otherSeason = upsertSnapshotForRound(db, {
    season: 2025,
    roundNumber: 2,
    valuesByQuestion: { q1: "other" },
    reviewStatus: REVIEW_STATUS_REVIEWED
  });
  publishActualSnapshot(db, { season: 2026, snapshotId: first.snapshotId });
  publishActualSnapshot(db, { season: 2025, snapshotId: otherSeason.snapshotId });
  publishActualSnapshot(db, { season: 2026, snapshotId: second.snapshotId });

  assert.deepEqual(loadPublishedActuals(db, 2026).values, { q1: "new" });
  assert.deepEqual(loadPublishedActuals(db, 2025).values, { q1: "other" });
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM published_actual_sets").get().count, 2);
});
