"use strict";

const path = require("path");
const { createAppDatabase } = require("../../src/app-database");
const { seedSeasonInputs } = require("../../scripts/seed-season-inputs");

module.exports = async () => {
  const dataDir = path.join(__dirname, "..", "..", ".tmp", "playwright-state");
  const db = createAppDatabase({
    databaseUrl: "",
    sqlitePath: process.env.DB_PATH || path.join(dataDir, "app.db")
  });
  try {
    seedSeasonInputs(db, { season: Number(process.env.F1_SEASON || 2026) });
  } finally {
    db.close();
  }
};
