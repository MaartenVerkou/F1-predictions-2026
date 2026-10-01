"use strict";

const path = require("path");
const { createAppDatabase } = require("../src/app-database");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const SEASON = Number(process.env.F1_SEASON || 2026);

function countRows(db, table, seasonId) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE season_id = ?`).get(seasonId);
  return Number(row?.count || 0);
}

function verifySeasonInputs(db, { season = SEASON, minimums = {} } = {}) {
  const required = {
    drivers: Number(minimums.drivers ?? 1),
    teams: Number(minimums.teams ?? 1),
    races: Number(minimums.races ?? 1)
  };
  const seasonRow = db.prepare("SELECT id, year, label, status FROM seasons WHERE year = ?").get(Number(season));
  if (!seasonRow) {
    throw new Error(`Canonical season catalog is missing for ${Number(season)}. Run scripts/seed-season-inputs.js before deploying.`);
  }

  const counts = {
    drivers: countRows(db, "season_drivers", seasonRow.id),
    teams: countRows(db, "season_teams", seasonRow.id),
    races: countRows(db, "races", seasonRow.id)
  };
  const missing = Object.entries(required)
    .filter(([key, minimum]) => counts[key] < minimum)
    .map(([key, minimum]) => `${key}=${counts[key]} (expected at least ${minimum})`);
  if (missing.length > 0) {
    throw new Error(`Canonical season catalog is incomplete for ${Number(season)}: ${missing.join(", ")}.`);
  }

  return {
    seasonId: Number(seasonRow.id),
    year: Number(seasonRow.year),
    label: seasonRow.label,
    status: seasonRow.status,
    ...counts
  };
}

function main() {
  const db = createAppDatabase({
    databaseUrl: String(process.env.DATABASE_URL || ""),
    sqlitePath: process.env.DB_PATH || path.join(DATA_DIR, "app.db")
  });
  try {
    console.log(JSON.stringify(verifySeasonInputs(db), null, 2));
  } finally {
    db.close?.();
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = { verifySeasonInputs };
