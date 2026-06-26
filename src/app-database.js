"use strict";

const Database = require("better-sqlite3");
const { PostgresSyncDatabase } = require("./postgres-sync-database");

function createAppDatabase({ databaseUrl = "", sqlitePath }) {
  if (databaseUrl) {
    return new PostgresSyncDatabase(databaseUrl);
  }

  const db = new Database(sqlitePath);
  db.dialect = "sqlite";
  return db;
}

module.exports = {
  createAppDatabase
};
