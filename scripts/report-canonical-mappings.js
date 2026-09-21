"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createAppDatabase } = require("../src/app-database");
const { listSeasonInputs, resolveEntity } = require("../src/season-inputs");
const { buildCanonicalCatalog, canonicalizeQuestionValue } = require("../src/canonical-answers");

const root = path.join(__dirname, "..");
const season = Number(process.env.F1_SEASON || 2026);
const dataDir = process.env.DATA_DIR || path.join(root, "data");
const questionsPath = process.env.QUESTIONS_PATH || path.join(dataDir, "questions.json");
const questionsJson = JSON.parse(fs.readFileSync(questionsPath, "utf8"));
const questions = Array.isArray(questionsJson) ? questionsJson : questionsJson.questions || [];
const questionById = new Map(questions.map((question) => [question.id, question]));

function parseValue(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (text.startsWith("[") || text.startsWith("{")) {
    try { return JSON.parse(text); } catch (_error) { return raw; }
  }
  return raw;
}

function walk(value, visit, keyPath = "value") {
  if (Array.isArray(value)) return value.forEach((item, index) => walk(item, visit, `${keyPath}[${index}]`));
  if (value && typeof value === "object") return Object.entries(value).forEach(([key, item]) => walk(item, visit, `${keyPath}.${key}`));
  if (typeof value === "string") visit(value, keyPath);
}

function questionKinds(question, keyPath) {
  const sourceKind = { drivers: "driver", teams: "team", races: "race" }[question?.options_source];
  if (sourceKind) return [sourceKind];
  if (/driver/i.test(keyPath)) return ["driver"];
  if (/team|constructor/i.test(keyPath)) return ["team"];
  if (/race/i.test(keyPath)) return ["race"];
  if (question?.type === "teammate_battle" && /winner/i.test(keyPath)) return ["driver", "team"];
  return [];
}

function scanValue(db, catalog, counts, question, raw, source) {
  const parsed = parseValue(raw);
  walk(parsed, (value, keyPath) => {
    for (const kind of questionKinds(question, keyPath)) {
      const result = resolveEntity(db, { entityType: kind, seasonId: catalog.seasonId, label: value });
      const match = String(value).match(/^(driver|team|race):(\d+)$/);
      if (match && match[1] === kind) counts.resolved += 1;
      else if (result.status === "resolved") counts.resolvable += 1;
      else if (result.status === "ambiguous") counts.ambiguous += 1;
      else counts.unresolved += 1;
      counts.samples.push({ source, question: question?.id || null, kind, value, status: match ? "resolved" : result.status });
    }
  });
}

function scanEvidence(db, catalog, counts) {
  const rows = db.prepare("SELECT round_number, payload_json FROM race_data_snapshots WHERE season = ? ORDER BY round_number").all(season);
  for (const row of rows) {
    let payload;
    try { payload = JSON.parse(row.payload_json || "{}"); } catch (_error) { continue; }
    const fakeQuestion = { id: `race-data-r${row.round_number}` };
    for (const section of ["race", "qualifying", "sprint"]) {
      for (const item of payload?.[section]?.rows || []) {
        scanValue(db, catalog, counts, { ...fakeQuestion, options_source: "drivers" }, JSON.stringify({ driver: item.driver_id ? `driver:${item.driver_id}` : item.driver }), `evidence:${row.round_number}:${section}:driver`);
        scanValue(db, catalog, counts, { ...fakeQuestion, options_source: "teams" }, JSON.stringify({ team: item.team_id ? `team:${item.team_id}` : item.constructor }), `evidence:${row.round_number}:${section}:team`);
      }
    }
  }
}

function main() {
  const db = createAppDatabase({ databaseUrl: process.env.DATABASE_URL, sqlitePath: process.env.DB_PATH });
  try {
    const inputCatalog = listSeasonInputs(db, season);
    const catalog = { ...buildCanonicalCatalog(inputCatalog), seasonId: inputCatalog.season?.id || null };
    const counts = { resolved: 0, resolvable: 0, ambiguous: 0, unresolved: 0, samples: [] };
    for (const row of db.prepare("SELECT question_id, answer FROM responses").all()) scanValue(db, catalog, counts, questionById.get(row.question_id), row.answer, "responses");
    for (const row of db.prepare("SELECT question_id, answer FROM guest_responses").all()) scanValue(db, catalog, counts, questionById.get(row.question_id), row.answer, "guest_responses");
    for (const row of db.prepare("SELECT question_id, value FROM actuals").all()) scanValue(db, catalog, counts, questionById.get(row.question_id), row.value, "actuals");
    for (const row of db.prepare("SELECT question_id, value FROM actual_snapshot_values").all()) scanValue(db, catalog, counts, questionById.get(row.question_id), row.value, "actual_snapshot_values");
    scanEvidence(db, catalog, counts);
    const samples = counts.samples.filter((item) => item.status !== "resolved").slice(0, 100);
    delete counts.samples;
    console.log(JSON.stringify({ season, catalog: { drivers: catalog.driver.length, teams: catalog.team.length, races: catalog.race.length }, counts, samples }, null, 2));
  } finally {
    db.close?.();
  }
}

if (require.main === module) main();
