"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const {
  ensureQuestionDefinitionsSchema,
  listQuestionDefinitions,
  renderQuestionPromptHtml,
  upsertQuestionDefinition
} = require("../src/question-definitions");

function createDb() {
  const db = new Database(":memory:");
  db.dialect = "sqlite";
  ensureQuestionDefinitionsSchema(db);
  return db;
}

test("definition catalog seeds shared and question-bound terms", () => {
  const db = createDb();
  const definitions = listQuestionDefinitions(db, { locale: "en" });
  assert.equal(definitions.length, 10);
  assert.deepEqual(
    definitions.find((definition) => definition.termKey === "dnf").questionIds,
    []
  );
  assert.deepEqual(
    definitions.find((definition) => definition.termKey === "grand_prix_podium").questionIds,
    ["all_podium_finishers", "mini_q3_ferrari_podium", "most_points_no_podium"]
  );
  ensureQuestionDefinitionsSchema(db);
  assert.equal(listQuestionDefinitions(db, { locale: "en" }).length, 10);
  db.close();
});

test("prompt rendering uses the same catalog for global and bound matches", () => {
  const db = createDb();
  const definitions = listQuestionDefinitions(db, { locale: "en" });
  const dnf = renderQuestionPromptHtml(
    { id: "most_dnfs_driver", prompt: "Which driver has the most DNFs? <script>" },
    definitions
  );
  assert.match(dnf, /question-term-label">DNFs<\/span>/);
  assert.doesNotMatch(dnf, /<script>/);

  const podium = renderQuestionPromptHtml(
    { id: "all_podium_finishers", prompt: "Select all podium finishers" },
    definitions
  );
  assert.match(podium, /question-term-label">podium finishers<\/span>/);

  const unrelated = renderQuestionPromptHtml(
    { id: "most_dnfs_driver", prompt: "Select all podium finishers" },
    definitions
  );
  assert.doesNotMatch(unrelated, /question-term-label/);
  assert.equal((dnf.match(/class="question-term"/g) || []).length, 1);
  db.close();
});

test("definition edits preserve the stable key and update bindings", () => {
  const db = createDb();
  const id = upsertQuestionDefinition(db, {
    termKey: "custom_term",
    label: "Custom",
    explanation: "A custom explanation.",
    aliases: ["custom", "custom term"],
    questionIds: ["drivers_championship_top_3"],
    sortOrder: 900,
    isActive: true
  }, { locale: "en" });
  assert.ok(id > 0);
  const fallbackBeforeArchive = listQuestionDefinitions(db, { locale: "nl" })
    .find((definition) => definition.id === id);
  assert.equal(fallbackBeforeArchive.explanation, "A custom explanation.");
  assert.deepEqual(fallbackBeforeArchive.aliases, ["custom term", "custom"]);
  assert.match(
    renderQuestionPromptHtml({ id: "drivers_championship_top_3", prompt: "Custom term" }, [fallbackBeforeArchive]),
    /question-term-label">Custom term<\/span>/
  );
  upsertQuestionDefinition(db, {
    id,
    termKey: "custom_term",
    label: "Updated",
    explanation: "Updated explanation.",
    aliases: ["updated"],
    questionIds: [],
    sortOrder: 901,
    isActive: false
  }, { locale: "en" });
  const archived = listQuestionDefinitions(db, { locale: "en", includeInactive: true })
    .find((definition) => definition.id === id);
  assert.equal(archived.termKey, "custom_term");
  assert.equal(archived.label, "Updated");
  assert.equal(archived.isActive, false);
  assert.equal(archived.sortOrder, 901);
  assert.deepEqual(archived.questionIds, []);
  assert.equal(listQuestionDefinitions(db, { locale: "en" }).some((definition) => definition.id === id), false);
  assert.doesNotMatch(
    renderQuestionPromptHtml(
      { id: "drivers_championship_top_3", prompt: "Updated" },
      listQuestionDefinitions(db, { locale: "en", includeInactive: true })
    ),
    /question-term/
  );
  const fallback = listQuestionDefinitions(db, { locale: "nl", includeInactive: true })
    .find((definition) => definition.id === id);
  assert.equal(fallback.explanation, "Updated explanation.");
  assert.deepEqual(fallback.aliases, ["updated"]);
  assert.throws(() => upsertQuestionDefinition(db, {
    termKey: "dnf",
    label: "Duplicate",
    explanation: "Duplicate",
    aliases: ["duplicate"]
  }), /already exists/);
  assert.throws(() => upsertQuestionDefinition(db, {
    termKey: "not valid",
    label: "Invalid",
    explanation: "Invalid",
    aliases: ["invalid"]
  }), /stable lowercase term key/);
  assert.throws(() => upsertQuestionDefinition(db, {
    termKey: "missing_aliases",
    label: "Invalid",
    explanation: "Invalid",
    aliases: []
  }), /At least one matching term/);
  db.close();
});
