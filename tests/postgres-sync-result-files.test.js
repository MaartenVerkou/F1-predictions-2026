"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const {
  cancelQueryResult,
  cleanupStaleQueryResultFiles,
  isQueryCancelled,
  writeQueryResultFile,
  STALE_QUERY_RESULT_FILE_AGE_MS
} = require("../src/postgres-sync-result-files");

function createTempDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "f1-pg-sync-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("cancelling a timed-out query marks its signal and removes its result file", (t) => {
  const directory = createTempDirectory(t);
  const resultPath = path.join(directory, "result.json");
  const signalBuffer = new SharedArrayBuffer(4);
  fs.writeFileSync(resultPath, "partial result");

  assert.equal(cancelQueryResult(signalBuffer, resultPath), true);
  assert.equal(isQueryCancelled(signalBuffer), true);
  assert.equal(fs.existsSync(resultPath), false);
});

test("a cancelled worker does not recreate its result file", (t) => {
  const directory = createTempDirectory(t);
  const resultPath = path.join(directory, "result.json");
  const signalBuffer = new SharedArrayBuffer(4);
  cancelQueryResult(signalBuffer, resultPath);

  assert.equal(writeQueryResultFile(signalBuffer, resultPath, "large result"), false);
  assert.equal(fs.existsSync(resultPath), false);
});

test("a completed result is preserved when a timeout races with completion", (t) => {
  const directory = createTempDirectory(t);
  const resultPath = path.join(directory, "result.json");
  const signalBuffer = new SharedArrayBuffer(4);
  fs.writeFileSync(resultPath, "completed result");
  Atomics.store(new Int32Array(signalBuffer), 0, 1);

  assert.equal(cancelQueryResult(signalBuffer, resultPath), false);
  assert.equal(fs.readFileSync(resultPath, "utf8"), "completed result");
});

test("startup cleanup removes only old PostgreSQL query result files", (t) => {
  const directory = createTempDirectory(t);
  const now = Date.now();
  const staleTimestamp = now - STALE_QUERY_RESULT_FILE_AGE_MS - 60_000;
  const stalePath = path.join(
    directory,
    `f1-pg-sync-123-${staleTimestamp}-${"a".repeat(12)}.json`
  );
  const recentPath = path.join(
    directory,
    `f1-pg-sync-123-${now}-${"b".repeat(12)}.json`
  );
  const unrelatedPath = path.join(directory, "keep-me.json");
  fs.writeFileSync(stalePath, "stale");
  fs.writeFileSync(recentPath, "recent");
  fs.writeFileSync(unrelatedPath, "unrelated");
  fs.utimesSync(stalePath, staleTimestamp / 1000, staleTimestamp / 1000);

  cleanupStaleQueryResultFiles({ directory, now });

  assert.equal(fs.existsSync(stalePath), false);
  assert.equal(fs.existsSync(recentPath), true);
  assert.equal(fs.existsSync(unrelatedPath), true);
});
