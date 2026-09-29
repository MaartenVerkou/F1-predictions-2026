"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { createAppDatabase } = require("../src/app-database");
const {
  REVIEW_STATUS_PENDING,
  findLatestSnapshotForRound,
  upsertSnapshotForRound
} = require("../src/actuals-snapshots");
const {
  linkEvidenceToActualSnapshot,
  listRaceDataSnapshots
} = require("../src/race-data-evidence");
const { buildSeasonCatalog } = require("../src/season-catalog");
const {
  DEFAULT_SCORING_RULES,
  readSeasonScoringRules
} = require("../src/season-scoring-rules");
const { deriveSnapshotsFromPersistedEvidence } = require("./backfill-actuals-2026");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") values.apply = true;
    else if (arg.startsWith("--")) values[arg.slice(2)] = argv[++index];
  }
  return values;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const season = Number(args.season || process.env.F1_SEASON || 2026);
  const maxRound = args["max-round"] == null ? null : Number(args["max-round"]);
  const questions = readJson(process.env.QUESTIONS_PATH || path.join(DATA_DIR, "questions.json")).questions || [];
  const roster = readJson(process.env.ROSTER_PATH || path.join(DATA_DIR, "roster.json"));
  const races = readJson(process.env.RACES_PATH || path.join(DATA_DIR, "races.json")).races || [];
  const db = createAppDatabase({
    databaseUrl: args["database-url"] || process.env.DATABASE_URL,
    sqlitePath: args["db-path"] || process.env.DB_PATH
  });

  try {
    const scoringRules = readSeasonScoringRules(db, season) || DEFAULT_SCORING_RULES;
    const evidenceRows = listRaceDataSnapshots(db, season)
      .filter((row) => maxRound == null || Number(row.round_number) <= maxRound);
    const rounds = evidenceRows.map((row) => Number(row.round_number));
    const catalog = buildSeasonCatalog(db, season, { questions });
    const derived = deriveSnapshotsFromPersistedEvidence(db, {
      season,
      rounds,
      questions,
      roster,
      races,
      totalRounds: races.length,
      scoringRules
    });
    const evidenceByRound = new Map(evidenceRows.map((row) => [Number(row.round_number), row]));
    const result = [];

    const apply = () => {
      for (const snapshot of derived) {
        const evidence = evidenceByRound.get(Number(snapshot.roundNumber));
        const existing = findLatestSnapshotForRound(db, season, snapshot.roundNumber);
        const upserted = upsertSnapshotForRound(db, {
          season,
          roundNumber: snapshot.roundNumber,
          roundName: snapshot.roundName,
          valuesByQuestion: snapshot.values,
          sourceType: "race_data_derivation",
          sourceNote: "Derived from the latest persisted race-data evidence revision.",
          label: `R${snapshot.roundNumber} - ${snapshot.roundName}`,
          reviewStatus: REVIEW_STATUS_PENDING,
          preserveReviewIfUnchanged: true,
          catalogRevision: catalog.catalogRevision,
          evidenceRevision: evidence?.payload_revision || evidence?.sync_id || null,
          derivationVersion: "race-data-derivation-v3"
        });
        if (upserted?.snapshotId && evidence?.id) {
          linkEvidenceToActualSnapshot(
            db,
            upserted.snapshotId,
            evidence.id,
            evidence.import_id || null
          );
        }
        result.push({
          roundNumber: snapshot.roundNumber,
          valueCount: Object.keys(snapshot.values || {}).length,
          previousSnapshotId: existing?.id || null,
          snapshotId: upserted?.snapshotId || existing?.id || null,
          valuesChanged: Boolean(upserted?.valuesChanged)
        });
      }
    };

    if (args.apply) {
      db.transaction(apply)();
    } else {
      for (const snapshot of derived) {
        result.push({
          roundNumber: snapshot.roundNumber,
          valueCount: Object.keys(snapshot.values || {}).length,
          values: snapshot.values
        });
      }
    }

    console.log(JSON.stringify({
      mode: args.apply ? "apply" : "dry-run",
      season,
      rounds,
      changedRounds: result.filter((item) => item.valuesChanged).length,
      snapshots: result
    }, null, 2));
  } finally {
    db.close?.();
  }
}

if (require.main === module) run();

module.exports = { parseArgs, run };
