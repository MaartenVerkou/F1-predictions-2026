"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const {
  ensureSeasonQuestionSettingsSchema,
  migrateLegacyQuestionSettings,
  readSeasonQuestionSettingsMap,
  upsertSeasonQuestionSettings
} = require("../src/season-question-settings");

function createDb() {
  const db = new Database(":memory:");
  db.dialect = "sqlite";
  db.exec(`
    CREATE TABLE question_settings (
      question_id TEXT PRIMARY KEY,
      included INTEGER NOT NULL DEFAULT 1,
      points_override TEXT,
      order_index INTEGER,
      prompt_override TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  ensureSeasonQuestionSettingsSchema(db);
  return db;
}

test("season question settings migrate global values once and preserve season isolation", () => {
  const db = createDb();
  db.prepare(
    `INSERT INTO question_settings
      (question_id, included, points_override, order_index, prompt_override, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run("top_three", 0, JSON.stringify({ "1st": 60 }), 2, "Season wording", "2026-01-01T00:00:00.000Z");

  assert.deepEqual(migrateLegacyQuestionSettings(db, 2026), { migrated: true, count: 1 });
  assert.deepEqual(migrateLegacyQuestionSettings(db, 2026), { migrated: false, count: 1 });

  const active = readSeasonQuestionSettingsMap(db, 2026).get("top_three");
  assert.equal(active.included, false);
  assert.deepEqual(active.parsedOverride, { "1st": 60 });
  assert.equal(active.orderIndex, 2);
  assert.equal(active.promptOverride, "Season wording");
  assert.equal(readSeasonQuestionSettingsMap(db, 2027).size, 0);
  db.close();
});

test("season question settings save complete normalized edits without changing question IDs", () => {
  const db = createDb();
  upsertSeasonQuestionSettings(db, 2027, [
    { questionId: "top_three", included: true, orderIndex: 0, promptOverride: "Pick three", pointsOverride: { "1st": 50 } },
    { questionId: "dnfs", included: false, orderIndex: 1, promptOverride: "Most DNFs", pointsOverride: null }
  ]);
  const rows = readSeasonQuestionSettingsMap(db, 2027);
  assert.equal(rows.size, 2);
  assert.equal(rows.get("top_three").promptOverride, "Pick three");
  assert.deepEqual(rows.get("top_three").parsedOverride, { "1st": 50 });
  assert.equal(rows.get("dnfs").included, false);
  db.close();
});
