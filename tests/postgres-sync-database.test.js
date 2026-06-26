"use strict";

const assert = require("assert/strict");
const test = require("node:test");
const {
  convertPlaceholders,
  splitSqlStatements,
  translateSql
} = require("../src/postgres-sync-database");

test("convertPlaceholders keeps quoted question marks intact", () => {
  assert.equal(
    convertPlaceholders("SELECT '?' AS literal, name FROM users WHERE id = ? AND email = ?"),
    "SELECT '?' AS literal, name FROM users WHERE id = $1 AND email = $2"
  );
});

test("translateSql maps INSERT OR IGNORE to PostgreSQL ON CONFLICT DO NOTHING", () => {
  assert.equal(
    translateSql(
      "INSERT OR IGNORE INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, 'member', ?)"
    ),
    "INSERT INTO group_members (user_id, group_id, role, joined_at) VALUES ($1, $2, 'member', $3) ON CONFLICT DO NOTHING"
  );
});

test("translateSql appends RETURNING id for identity inserts used with run", () => {
  assert.equal(
    translateSql("INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)", {
      addReturningId: true
    }),
    "INSERT INTO users (name, email, password_hash, created_at) VALUES ($1, $2, $3, $4) RETURNING id"
  );
});

test("splitSqlStatements handles semicolons inside string literals", () => {
  assert.deepEqual(
    splitSqlStatements("UPDATE users SET name = 'A; B' WHERE id = 1; SELECT 1;"),
    ["UPDATE users SET name = 'A; B' WHERE id = 1", "SELECT 1"]
  );
});
