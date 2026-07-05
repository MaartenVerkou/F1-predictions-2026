"use strict";

const REVIEW_STATUS_PENDING = "pending";
const REVIEW_STATUS_REVIEWED = "reviewed";

function normalizeReviewStatus(raw) {
  return String(raw || "").trim().toLowerCase() === REVIEW_STATUS_PENDING
    ? REVIEW_STATUS_PENDING
    : REVIEW_STATUS_REVIEWED;
}

function listColumnNames(db, tableName) {
  return new Set(
    db
      .prepare(`PRAGMA table_info(${tableName});`)
      .all()
      .map((column) => column.name)
  );
}

function ensureActualSnapshotColumns(db) {
  const names = listColumnNames(db, "actual_snapshots");
  if (!names.has("updated_at")) {
    db.exec("ALTER TABLE actual_snapshots ADD COLUMN updated_at TEXT;");
  }
  if (!names.has("review_status")) {
    db.exec("ALTER TABLE actual_snapshots ADD COLUMN review_status TEXT DEFAULT 'reviewed';");
  }
  if (!names.has("reviewed_at")) {
    db.exec("ALTER TABLE actual_snapshots ADD COLUMN reviewed_at TEXT;");
  }
  if (!names.has("reviewed_by_user_id")) {
    db.exec("ALTER TABLE actual_snapshots ADD COLUMN reviewed_by_user_id INTEGER;");
  }

  db.exec(`
    UPDATE actual_snapshots
    SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at)
    WHERE updated_at IS NULL OR updated_at = '';

    UPDATE actual_snapshots
    SET review_status = CASE
      WHEN LOWER(TRIM(COALESCE(review_status, ''))) = '${REVIEW_STATUS_PENDING}' THEN '${REVIEW_STATUS_PENDING}'
      ELSE '${REVIEW_STATUS_REVIEWED}'
    END
    WHERE review_status IS NULL
       OR TRIM(COALESCE(review_status, '')) = ''
       OR LOWER(TRIM(COALESCE(review_status, ''))) NOT IN ('${REVIEW_STATUS_PENDING}', '${REVIEW_STATUS_REVIEWED}');

    UPDATE actual_snapshots
    SET reviewed_at = COALESCE(reviewed_at, updated_at, created_at)
    WHERE review_status = '${REVIEW_STATUS_REVIEWED}'
      AND reviewed_at IS NULL;

    UPDATE actual_snapshots
    SET reviewed_by_user_id = COALESCE(reviewed_by_user_id, created_by_user_id)
    WHERE review_status = '${REVIEW_STATUS_REVIEWED}'
      AND reviewed_by_user_id IS NULL
      AND created_by_user_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_actual_snapshots_review_status
      ON actual_snapshots(season, review_status, round_number);
  `);
}

function mapSnapshotRow(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    season: Number(row.season),
    round_number:
      row.round_number == null || row.round_number === ""
        ? null
        : Number(row.round_number),
    review_status: normalizeReviewStatus(row.review_status),
    reviewed_by_user_id:
      row.reviewed_by_user_id == null || row.reviewed_by_user_id === ""
        ? null
        : Number(row.reviewed_by_user_id)
  };
}

function fetchSnapshotValues(db, snapshotId) {
  return db
    .prepare(
      `
      SELECT question_id, value
      FROM actual_snapshot_values
      WHERE snapshot_id = ?
      ORDER BY question_id ASC
      `
    )
    .all(snapshotId)
    .reduce((acc, row) => {
      acc[row.question_id] = row.value;
      return acc;
    }, {});
}

function normalizeMaxRoundNumber(options = {}) {
  const maxRoundNumber = Number(options.maxRoundNumber);
  return Number.isFinite(maxRoundNumber) && maxRoundNumber > 0
    ? Math.floor(maxRoundNumber)
    : null;
}

function isSnapshotWithinRoundLimit(snapshot, options = {}) {
  const maxRoundNumber = normalizeMaxRoundNumber(options);
  if (maxRoundNumber == null) return true;
  const roundNumber = Number(snapshot?.round_number);
  return Number.isFinite(roundNumber) && roundNumber > 0 && roundNumber <= maxRoundNumber;
}

function findLatestSnapshotForRound(db, season, roundNumber, options = {}) {
  if (!isSnapshotWithinRoundLimit({ round_number: roundNumber }, options)) return null;
  return mapSnapshotRow(
    db
      .prepare(
        `
        SELECT
          id,
          season,
          round_number,
          round_name,
          label,
          source_type,
          source_note,
          created_at,
          updated_at,
          created_by_user_id,
          review_status,
          reviewed_at,
          reviewed_by_user_id
        FROM actual_snapshots
        WHERE season = ?
          AND round_number = ?
        ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
        LIMIT 1
        `
      )
      .get(season, roundNumber)
  );
}

function findLatestRoundSnapshotForSeason(db, season, options = {}) {
  const maxRoundNumber = normalizeMaxRoundNumber(options);
  const params = [season];
  const roundLimitClause =
    maxRoundNumber == null
      ? ""
      : "AND round_number <= ?";
  if (maxRoundNumber != null) params.push(maxRoundNumber);
  return mapSnapshotRow(
    db
      .prepare(
        `
        SELECT
          id,
          season,
          round_number,
          round_name,
          label,
          source_type,
          source_note,
          created_at,
          updated_at,
          created_by_user_id,
          review_status,
          reviewed_at,
          reviewed_by_user_id
        FROM actual_snapshots
        WHERE season = ?
          AND round_number IS NOT NULL
          ${roundLimitClause}
        ORDER BY round_number DESC, COALESCE(updated_at, created_at) DESC, id DESC
        LIMIT 1
        `
      )
      .get(...params)
  );
}

function listLatestSnapshotsForSeason(db, season, options = {}) {
  const maxRoundNumber = normalizeMaxRoundNumber(options);
  const params = [season];
  const roundLimitClause =
    maxRoundNumber == null
      ? ""
      : "AND round_number <= ?";
  if (maxRoundNumber != null) params.push(maxRoundNumber);
  const rows = db
    .prepare(
      `
      SELECT
        id,
        season,
        round_number,
        round_name,
        label,
        source_type,
        source_note,
        created_at,
        updated_at,
        created_by_user_id,
        review_status,
        reviewed_at,
        reviewed_by_user_id
      FROM actual_snapshots
      WHERE season = ?
        AND round_number IS NOT NULL
        ${roundLimitClause}
      ORDER BY round_number ASC, COALESCE(updated_at, created_at) DESC, id DESC
      `
    )
    .all(...params);
  const latestByRound = new Map();
  rows.forEach((row) => {
    const snapshot = mapSnapshotRow(row);
    if (!Number.isFinite(snapshot?.round_number) || snapshot.round_number <= 0) return;
    if (!latestByRound.has(snapshot.round_number)) {
      latestByRound.set(snapshot.round_number, snapshot);
    }
  });
  return Array.from(latestByRound.values()).sort((a, b) => a.round_number - b.round_number);
}

function findSnapshotById(db, snapshotId, options = {}) {
  const snapshot = mapSnapshotRow(
    db
      .prepare(
        `
        SELECT
          id,
          season,
          round_number,
          round_name,
          label,
          source_type,
          source_note,
          created_at,
          updated_at,
          created_by_user_id,
          review_status,
          reviewed_at,
          reviewed_by_user_id
        FROM actual_snapshots
        WHERE id = ?
        LIMIT 1
        `
      )
      .get(snapshotId)
  );
  return isSnapshotWithinRoundLimit(snapshot, options) ? snapshot : null;
}

function filterNonEmptyValues(valuesByQuestion) {
  return Object.entries(valuesByQuestion || {}).filter(([, value]) => value != null && value !== "");
}

function snapshotValuesEqual(left, right) {
  const leftEntries = filterNonEmptyValues(left).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = filterNonEmptyValues(right).sort(([a], [b]) => a.localeCompare(b));
  if (leftEntries.length !== rightEntries.length) return false;
  for (let index = 0; index < leftEntries.length; index += 1) {
    const [leftKey, leftValue] = leftEntries[index];
    const [rightKey, rightValue] = rightEntries[index];
    if (leftKey !== rightKey || String(leftValue) !== String(rightValue)) {
      return false;
    }
  }
  return true;
}

function sanitizeSnapshotMeta({
  season,
  roundNumber,
  roundName = "",
  sourceType = "manual",
  sourceNote = "",
  createdByUserId = null,
  label = ""
}) {
  const now = new Date().toISOString();
  const safeSeason = Number.isFinite(Number(season)) ? Number(season) : null;
  const parsedRound = Number(roundNumber);
  const safeRoundNumber =
    Number.isFinite(parsedRound) && parsedRound > 0 ? Math.floor(parsedRound) : null;
  const safeRoundName = String(roundName || "").trim();
  const safeLabel = String(label || "").trim() || (
    safeRoundNumber
      ? `R${safeRoundNumber} - ${safeRoundName || "Snapshot"}`
      : `Manual snapshot ${now.slice(0, 10)}`
  );
  const safeSourceType = String(sourceType || "").trim() || "manual";
  const safeSourceNote = String(sourceNote || "").trim() || null;
  const safeUserId = Number.isFinite(Number(createdByUserId))
    ? Number(createdByUserId)
    : null;
  return {
    now,
    safeSeason,
    safeRoundNumber,
    safeRoundName,
    safeLabel,
    safeSourceType,
    safeSourceNote,
    safeUserId
  };
}

function upsertSnapshotForRound(db, {
  season,
  roundNumber,
  roundName = "",
  valuesByQuestion,
  sourceType = "manual",
  sourceNote = "",
  createdByUserId = null,
  label = "",
  reviewStatus = REVIEW_STATUS_REVIEWED,
  preserveReviewIfUnchanged = false
}) {
  const entries = filterNonEmptyValues(valuesByQuestion);
  if (entries.length === 0) return null;

  const meta = sanitizeSnapshotMeta({
    season,
    roundNumber,
    roundName,
    sourceType,
    sourceNote,
    createdByUserId,
    label
  });
  const existing = meta.safeRoundNumber
    ? findLatestSnapshotForRound(db, meta.safeSeason, meta.safeRoundNumber)
    : null;
  const nextValues = Object.fromEntries(entries);
  const existingValues = existing ? fetchSnapshotValues(db, existing.id) : {};
  const valuesChanged = !existing || !snapshotValuesEqual(existingValues, nextValues);

  let nextReviewStatus = normalizeReviewStatus(reviewStatus);
  let nextReviewedAt = nextReviewStatus === REVIEW_STATUS_REVIEWED ? meta.now : null;
  let nextReviewedByUserId =
    nextReviewStatus === REVIEW_STATUS_REVIEWED ? meta.safeUserId : null;

  if (existing && preserveReviewIfUnchanged && !valuesChanged) {
    nextReviewStatus = normalizeReviewStatus(existing.review_status);
    nextReviewedAt = existing.reviewed_at || null;
    nextReviewedByUserId = existing.reviewed_by_user_id || null;
  }

  const insertSnapshot = db.prepare(
    `
    INSERT INTO actual_snapshots (
      season,
      round_number,
      round_name,
      label,
      source_type,
      source_note,
      created_at,
      updated_at,
      created_by_user_id,
      review_status,
      reviewed_at,
      reviewed_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );
  const insertValue = db.prepare(
    `
    INSERT INTO actual_snapshot_values (snapshot_id, question_id, value)
    VALUES (?, ?, ?)
    `
  );

  const tx = db.transaction(() => {
    let snapshotId = existing ? Number(existing.id) : null;
    const shouldReuseExistingSnapshot =
      Boolean(snapshotId)
      && preserveReviewIfUnchanged
      && !valuesChanged
      && normalizeReviewStatus(existing.review_status) === nextReviewStatus
      && String(existing.reviewed_at || "") === String(nextReviewedAt || "")
      && Number(existing.reviewed_by_user_id || 0) === Number(nextReviewedByUserId || 0);

    if (shouldReuseExistingSnapshot) {
      return {
        snapshotId,
        valuesChanged,
        reviewStatus: nextReviewStatus
      };
    }

    const snapshotInfo = insertSnapshot.run(
      meta.safeSeason,
      meta.safeRoundNumber,
      meta.safeRoundName || null,
      meta.safeLabel,
      meta.safeSourceType,
      meta.safeSourceNote,
      meta.now,
      meta.now,
      meta.safeUserId,
      nextReviewStatus,
      nextReviewedAt,
      nextReviewedByUserId
    );
    snapshotId = Number(snapshotInfo.lastInsertRowid);

    entries.forEach(([questionId, value]) => {
      insertValue.run(snapshotId, questionId, value);
    });
    return {
      snapshotId,
      valuesChanged,
      reviewStatus: nextReviewStatus
    };
  });

  return tx();
}

function markSnapshotReviewed(db, {
  snapshotId,
  reviewedByUserId = null,
  reviewedAt = new Date().toISOString()
}) {
  const safeSnapshotId = Number(snapshotId);
  if (!Number.isFinite(safeSnapshotId) || safeSnapshotId <= 0) return 0;
  const safeUserId = Number.isFinite(Number(reviewedByUserId))
    ? Number(reviewedByUserId)
    : null;
  const result = db.prepare(
    `
    UPDATE actual_snapshots
    SET review_status = ?,
        reviewed_at = ?,
        reviewed_by_user_id = ?,
        updated_at = COALESCE(updated_at, created_at)
    WHERE id = ?
    `
  ).run(REVIEW_STATUS_REVIEWED, reviewedAt, safeUserId, safeSnapshotId);
  return Number(result.changes || 0);
}

module.exports = {
  REVIEW_STATUS_PENDING,
  REVIEW_STATUS_REVIEWED,
  ensureActualSnapshotColumns,
  fetchSnapshotValues,
  findLatestRoundSnapshotForSeason,
  findLatestSnapshotForRound,
  findSnapshotById,
  listLatestSnapshotsForSeason,
  markSnapshotReviewed,
  normalizeReviewStatus,
  snapshotValuesEqual,
  upsertSnapshotForRound
};
