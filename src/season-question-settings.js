"use strict";

function normalizeSeason(value) {
  const season = Number(value);
  if (!Number.isInteger(season) || season < 1900 || season > 2200) {
    throw new Error("A valid season year is required.");
  }
  return season;
}

function ensureSeasonQuestionSettingsSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS season_question_settings (
      season INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      included INTEGER NOT NULL DEFAULT 1,
      points_override TEXT,
      order_index INTEGER,
      prompt_override TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (season, question_id)
    );
    CREATE INDEX IF NOT EXISTS idx_season_question_settings_order
      ON season_question_settings(season, order_index, question_id);
  `);
}

function parsePointsOverride(row) {
  const rawOverride = row?.points_override == null
    ? ""
    : String(row.points_override).trim();
  let parsedOverride = null;
  let hasValidOverride = false;
  if (rawOverride) {
    try {
      parsedOverride = JSON.parse(rawOverride);
      hasValidOverride = true;
    } catch (error) {
      // Keep the invalid value visible to the admin editor without applying it.
    }
  }
  const orderIndexRaw = row?.order_index;
  const orderIndex = orderIndexRaw == null || !Number.isFinite(Number(orderIndexRaw))
    ? null
    : Number(orderIndexRaw);
  return {
    included: Number(row?.included) !== 0,
    rawOverride,
    parsedOverride,
    hasValidOverride,
    orderIndex,
    promptOverride: row?.prompt_override == null ? "" : String(row.prompt_override).trim()
  };
}

function applySeasonQuestionSettings(questions, settingsMap, {
  includeExcluded = false,
  includeMeta = false
} = {}) {
  const out = [];
  for (const [sourceIndex, original] of (questions || []).entries()) {
    const setting = settingsMap.get(original.id);
    const included = setting ? setting.included : true;
    if (!includeExcluded && !included) continue;

    const question = { ...original };
    const basePoints = question.points;
    if (setting?.promptOverride) {
      question.prompt = setting.promptOverride;
      question._promptOverrideRaw = setting.promptOverride;
    }
    if (setting?.hasValidOverride) {
      question.points = setting.parsedOverride;
      delete question.points_display;
    }

    if (includeMeta) {
      question._included = included;
      question._basePoints = basePoints;
      question._effectivePoints = question.points;
      question._pointsOverrideRaw = setting?.rawOverride || "";
      question._hasValidPointsOverride = Boolean(setting?.hasValidOverride);
      question._promptOverrideRaw = setting?.promptOverride || "";
      question._orderIndex = setting && Number.isFinite(Number(setting.orderIndex))
        ? Number(setting.orderIndex)
        : sourceIndex;
    }

    question._sourceIndex = sourceIndex;
    question._sortOrderIndex = setting && Number.isFinite(Number(setting.orderIndex))
      ? Number(setting.orderIndex)
      : sourceIndex;
    out.push(question);
  }
  out.sort((left, right) => {
    if (left._sortOrderIndex !== right._sortOrderIndex) {
      return left._sortOrderIndex - right._sortOrderIndex;
    }
    return left._sourceIndex - right._sourceIndex;
  });
  for (const question of out) {
    delete question._sortOrderIndex;
    delete question._sourceIndex;
  }
  return out;
}

function readSeasonQuestionSettingsMap(db, season) {
  const normalizedSeason = normalizeSeason(season);
  const rows = db.prepare(
    `SELECT question_id, included, points_override, order_index, prompt_override
       FROM season_question_settings
      WHERE season = ?`
  ).all(normalizedSeason);
  return new Map(rows.map((row) => [String(row.question_id), parsePointsOverride(row)]));
}

function countSeasonQuestionSettings(db, season) {
  const normalizedSeason = normalizeSeason(season);
  const row = db.prepare(
    "SELECT COUNT(*) AS count FROM season_question_settings WHERE season = ?"
  ).get(normalizedSeason);
  return Number(row?.count || 0);
}

function migrateLegacyQuestionSettings(db, season) {
  const normalizedSeason = normalizeSeason(season);
  if (countSeasonQuestionSettings(db, normalizedSeason) > 0) {
    return { migrated: false, count: countSeasonQuestionSettings(db, normalizedSeason) };
  }
  const legacyRows = db.prepare(
    `SELECT question_id, included, points_override, order_index, prompt_override, updated_at
       FROM question_settings
      ORDER BY COALESCE(order_index, 2147483647), question_id`
  ).all();
  if (!legacyRows.length) return { migrated: false, count: 0 };

  const insert = db.prepare(
    `INSERT INTO season_question_settings
       (season, question_id, included, points_override, order_index, prompt_override, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(season, question_id) DO NOTHING`
  );
  const migrate = db.transaction(() => {
    for (const row of legacyRows) {
      insert.run(
        normalizedSeason,
        String(row.question_id),
        Number(row.included) === 0 ? 0 : 1,
        row.points_override == null ? null : String(row.points_override),
        row.order_index == null ? null : Number(row.order_index),
        row.prompt_override == null ? null : String(row.prompt_override),
        row.updated_at || new Date().toISOString()
      );
    }
  });
  migrate();
  return { migrated: true, count: legacyRows.length };
}

function upsertSeasonQuestionSettings(db, season, edits, updatedAt = new Date().toISOString()) {
  const normalizedSeason = normalizeSeason(season);
  const upsert = db.prepare(
    `INSERT INTO season_question_settings
       (season, question_id, included, points_override, order_index, prompt_override, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(season, question_id) DO UPDATE SET
       included = excluded.included,
       points_override = excluded.points_override,
       order_index = excluded.order_index,
       prompt_override = excluded.prompt_override,
       updated_at = excluded.updated_at`
  );
  const save = db.transaction(() => {
    for (const edit of edits || []) {
      upsert.run(
        normalizedSeason,
        String(edit.questionId),
        edit.included ? 1 : 0,
        edit.pointsOverride == null ? null : JSON.stringify(edit.pointsOverride),
        Number(edit.orderIndex),
        String(edit.promptOverride || ""),
        updatedAt
      );
    }
  });
  save();
  return edits?.length || 0;
}

module.exports = {
  applySeasonQuestionSettings,
  countSeasonQuestionSettings,
  ensureSeasonQuestionSettingsSchema,
  migrateLegacyQuestionSettings,
  normalizeSeason,
  parsePointsOverride,
  readSeasonQuestionSettingsMap,
  upsertSeasonQuestionSettings
};
