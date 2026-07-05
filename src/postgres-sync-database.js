"use strict";

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Worker } = require("worker_threads");
const { IDENTITY_TABLES } = require("./postgres-schema");

const DEFAULT_QUERY_TIMEOUT_MS = 30000;

function stripTrailingSemicolon(sql) {
  return String(sql || "").trim().replace(/;+\s*$/, "");
}

function convertPlaceholders(sql) {
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let output = "";

  for (let pos = 0; pos < sql.length; pos += 1) {
    const char = sql[pos];
    const next = sql[pos + 1];

    if (char === "'" && !inDoubleQuote) {
      output += char;
      if (inSingleQuote && next === "'") {
        output += next;
        pos += 1;
      } else {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      output += char;
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === "?" && !inSingleQuote && !inDoubleQuote) {
      index += 1;
      output += `$${index}`;
      continue;
    }

    output += char;
  }

  return output;
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let pos = 0; pos < sql.length; pos += 1) {
    const char = sql[pos];
    const next = sql[pos + 1];

    if (char === "'" && !inDoubleQuote) {
      current += char;
      if (inSingleQuote && next === "'") {
        current += next;
        pos += 1;
      } else {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      current += char;
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ";" && !inSingleQuote && !inDoubleQuote) {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = "";
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

function getInsertTableName(sql) {
  const match = stripTrailingSemicolon(sql).match(/^INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/i);
  return match ? match[1].toLowerCase() : null;
}

function addReturningId(sql) {
  const trimmed = stripTrailingSemicolon(sql);
  if (/\bRETURNING\b/i.test(trimmed)) return trimmed;
  const tableName = getInsertTableName(trimmed);
  if (!tableName || !IDENTITY_TABLES.has(tableName)) return trimmed;
  return `${trimmed} RETURNING id`;
}

function convertInsertOrIgnore(sql) {
  const converted = sql.replace(/^INSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO");
  if (converted === sql) return sql;
  if (/\bON\s+CONFLICT\b/i.test(converted)) return converted;
  return `${stripTrailingSemicolon(converted)} ON CONFLICT DO NOTHING`;
}

function translateSqlStatement(sql, options = {}) {
  const trimmed = stripTrailingSemicolon(sql);
  if (/^INSERT\s+OR\s+REPLACE\s+INTO\b/i.test(trimmed)) {
    throw new Error("INSERT OR REPLACE is not supported by the PostgreSQL compatibility layer.");
  }
  let translated = convertInsertOrIgnore(trimmed);
  translated = convertPlaceholders(translated);
  if (options.addReturningId) {
    translated = addReturningId(translated);
  }
  return translated;
}

function translateSql(sql, options = {}) {
  const statements = splitSqlStatements(sql);
  if (statements.length <= 1) {
    return translateSqlStatement(sql, options);
  }
  return statements
    .map((statement) => translateSqlStatement(statement, options))
    .join(";\n");
}

function parsePragmaTableInfo(sql) {
  const match = String(sql || "")
    .trim()
    .match(/^PRAGMA\s+table_info\((?:'|")?([a-zA-Z_][a-zA-Z0-9_]*)(?:'|")?\);?$/i);
  return match ? match[1] : null;
}

class PostgresPragmaTableInfoStatement {
  constructor(database, tableName) {
    this.database = database;
    this.tableName = tableName;
  }

  all() {
    return this.database
      .prepare(
        `
        SELECT column_name AS name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ?
        ORDER BY ordinal_position ASC
        `
      )
      .all(this.tableName);
  }

  get() {
    return this.all()[0];
  }

  run() {
    throw new Error("PRAGMA table_info is read-only.");
  }
}

class PostgresStatement {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
  }

  all(...params) {
    return this.database._query("all", translateSql(this.sql), params);
  }

  get(...params) {
    const row = this.database._query("get", translateSql(this.sql), params);
    return row || undefined;
  }

  run(...params) {
    return this.database._query(
      "run",
      translateSql(this.sql, { addReturningId: true }),
      params
    );
  }
}

class PostgresSyncDatabase {
  constructor(connectionString, options = {}) {
    if (!connectionString) {
      throw new Error("PostgresSyncDatabase requires a connection string.");
    }
    this.dialect = "postgres";
    this.queryTimeoutMs = Number(options.queryTimeoutMs || DEFAULT_QUERY_TIMEOUT_MS);
    this.worker = new Worker(path.join(__dirname, "postgres-sync-worker.js"), {
      workerData: { connectionString }
    });
    this.transactionDepth = 0;
  }

  prepare(sql) {
    const pragmaTableName = parsePragmaTableInfo(sql);
    if (pragmaTableName) {
      return new PostgresPragmaTableInfoStatement(this, pragmaTableName);
    }
    return new PostgresStatement(this, sql);
  }

  exec(sql) {
    const translated = translateSql(sql);
    return this._call({
      type: "query",
      mode: "exec",
      sql: translated,
      params: []
    });
  }

  pragma() {
    return undefined;
  }

  transaction(fn) {
    return (...args) => {
      if (this.transactionDepth > 0) {
        return fn(...args);
      }
      this.transactionDepth += 1;
      this._call({ type: "begin" });
      try {
        const result = fn(...args);
        this._call({ type: "commit" });
        return result;
      } catch (err) {
        try {
          this._call({ type: "rollback" });
        } finally {
          throw err;
        }
      } finally {
        this.transactionDepth -= 1;
      }
    };
  }

  close() {
    if (!this.worker) return;
    try {
      this._call({ type: "close" });
    } finally {
      this.worker.terminate();
      this.worker = null;
    }
  }

  _query(mode, sql, params) {
    return this._call({
      type: "query",
      mode,
      sql,
      params
    });
  }

  _call(payload) {
    if (!this.worker) {
      throw new Error("PostgreSQL worker is closed.");
    }

    const signal = new Int32Array(new SharedArrayBuffer(4));
    const resultPath = path.join(
      os.tmpdir(),
      `f1-pg-sync-${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.json`
    );
    this.worker.postMessage({
      ...payload,
      signalBuffer: signal.buffer,
      resultPath
    });

    const waitResult = Atomics.wait(signal, 0, 0, this.queryTimeoutMs);
    if (waitResult === "timed-out") {
      throw new Error(`PostgreSQL query timed out after ${this.queryTimeoutMs}ms.`);
    }

    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(resultPath, "utf8"));
    } finally {
      fs.rmSync(resultPath, { force: true });
    }

    if (!parsed.ok) {
      const err = new Error(parsed.error?.message || "PostgreSQL query failed.");
      err.name = parsed.error?.name || err.name;
      err.stack = parsed.error?.stack || err.stack;
      err.sql = parsed.sql || payload.sql || "";
      throw err;
    }
    return parsed.value;
  }
}

module.exports = {
  PostgresSyncDatabase,
  convertPlaceholders,
  splitSqlStatements,
  translateSql
};
