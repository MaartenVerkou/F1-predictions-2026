"use strict";

const path = require("path");
const Database = require("better-sqlite3");
const pg = require("pg");
const {
  APP_TABLES,
  IDENTITY_TABLES,
  POSTGRES_SCHEMA_SQL
} = require("../src/postgres-schema");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");

function parseArgs(argv) {
  const args = {
    sqlitePath: process.env.DB_PATH || path.join(DATA_DIR, "app.db"),
    databaseUrl: String(process.env.DATABASE_URL || "").trim(),
    reset: false
  };

  for (const arg of argv) {
    if (arg === "--reset") {
      args.reset = true;
    } else if (arg.startsWith("--sqlite=")) {
      args.sqlitePath = path.resolve(arg.slice("--sqlite=".length));
    } else if (arg.startsWith("--database-url=")) {
      args.databaseUrl = String(arg.slice("--database-url=".length)).trim();
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.databaseUrl) {
    throw new Error("Set DATABASE_URL or pass --database-url=postgres://...");
  }
  return args;
}

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, "\"\"")}"`;
}

function listSqliteColumns(sqlite, tableName) {
  return sqlite
    .prepare(`PRAGMA table_info(${tableName});`)
    .all()
    .map((column) => column.name);
}

async function listPostgresColumns(client, tableName) {
  const result = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position ASC
    `,
    [tableName]
  );
  return result.rows.map((row) => row.column_name);
}

async function tableCount(client, tableName) {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdent(tableName)}`);
  return Number(result.rows[0]?.count || 0);
}

async function resetIdentitySequence(client, tableName) {
  if (!IDENTITY_TABLES.has(tableName)) return;
  const sequenceResult = await client.query("SELECT pg_get_serial_sequence($1, 'id') AS sequence_name", [
    tableName
  ]);
  const sequenceName = sequenceResult.rows[0]?.sequence_name;
  if (!sequenceName) return;

  const maxResult = await client.query(`SELECT MAX(id)::int AS max_id FROM ${quoteIdent(tableName)}`);
  const maxId = Number(maxResult.rows[0]?.max_id || 0);
  if (maxId > 0) {
    await client.query("SELECT setval($1, $2, true)", [sequenceName, maxId]);
  } else {
    await client.query("SELECT setval($1, 1, false)", [sequenceName]);
  }
}

async function insertRows(client, tableName, columns, rows) {
  if (rows.length === 0 || columns.length === 0) return;
  const columnSql = columns.map(quoteIdent).join(", ");

  for (const row of rows) {
    const values = columns.map((column) => row[column]);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
    await client.query(
      `INSERT INTO ${quoteIdent(tableName)} (${columnSql}) VALUES (${placeholders})`,
      values
    );
  }
}

async function migrateTable({ sqlite, client, tableName }) {
  const sqliteColumns = listSqliteColumns(sqlite, tableName);
  if (sqliteColumns.length === 0) {
    return {
      table: tableName,
      sqliteRows: 0,
      postgresRows: await tableCount(client, tableName),
      skipped: true
    };
  }

  const postgresColumns = new Set(await listPostgresColumns(client, tableName));
  const columns = sqliteColumns.filter((column) => postgresColumns.has(column));
  const rows = sqlite.prepare(`SELECT ${columns.map(quoteIdent).join(", ")} FROM ${quoteIdent(tableName)}`).all();
  await insertRows(client, tableName, columns, rows);
  await resetIdentitySequence(client, tableName);

  return {
    table: tableName,
    sqliteRows: rows.length,
    postgresRows: await tableCount(client, tableName),
    skipped: false
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sqlite = new Database(args.sqlitePath, { readonly: true });
  const client = new pg.Client({ connectionString: args.databaseUrl });
  await client.connect();

  const results = [];
  try {
    await client.query("BEGIN");
    await client.query(POSTGRES_SCHEMA_SQL);
    if (args.reset) {
      await client.query(
        `TRUNCATE ${APP_TABLES.map(quoteIdent).join(", ")} RESTART IDENTITY`
      );
    }

    for (const tableName of APP_TABLES) {
      results.push(await migrateTable({ sqlite, client, tableName }));
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    sqlite.close();
    await client.end();
  }

  const mismatches = results.filter((row) => !row.skipped && row.sqliteRows !== row.postgresRows);
  const summary = {
    mode: "sqlite-to-postgres",
    sqlitePath: args.sqlitePath,
    reset: args.reset,
    tables: results,
    ok: mismatches.length === 0,
    mismatches
  };
  console.log(JSON.stringify(summary, null, 2));
  if (mismatches.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
