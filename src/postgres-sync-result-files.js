"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const QUERY_SIGNAL_CANCELLED = 2;
const STALE_QUERY_RESULT_FILE_AGE_MS = 60 * 60 * 1000;
const QUERY_RESULT_FILE_PATTERN = /^f1-pg-sync-\d+-(\d+)-[a-f0-9]{12}\.json$/i;

function isQueryCancelled(signalBuffer) {
  return Atomics.load(new Int32Array(signalBuffer), 0) === QUERY_SIGNAL_CANCELLED;
}

function removeQueryResultFile(resultPath) {
  try {
    fs.rmSync(resultPath, { force: true });
  } catch (_err) {
    // Result-file cleanup must not mask the original query outcome.
  }
}

function cancelQueryResult(signalBuffer, resultPath) {
  const signal = new Int32Array(signalBuffer);
  const status = Atomics.compareExchange(signal, 0, 0, QUERY_SIGNAL_CANCELLED);
  if (status === 1) return false;

  removeQueryResultFile(resultPath);
  return true;
}

function writeQueryResultFile(signalBuffer, resultPath, serializedResult) {
  if (isQueryCancelled(signalBuffer)) {
    removeQueryResultFile(resultPath);
    return false;
  }

  try {
    fs.writeFileSync(resultPath, serializedResult, "utf8");
  } catch (err) {
    removeQueryResultFile(resultPath);
    throw err;
  }

  if (isQueryCancelled(signalBuffer)) {
    removeQueryResultFile(resultPath);
    return false;
  }

  return true;
}

function cleanupStaleQueryResultFiles({ directory = os.tmpdir(), now = Date.now() } = {}) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (_err) {
    return 0;
  }

  let removedCount = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = QUERY_RESULT_FILE_PATTERN.exec(entry.name);
    if (!match) continue;

    const createdAt = Number(match[1]);
    if (!Number.isSafeInteger(createdAt) || now - createdAt < STALE_QUERY_RESULT_FILE_AGE_MS) {
      continue;
    }

    const resultPath = path.join(directory, entry.name);
    try {
      const stat = fs.statSync(resultPath);
      if (now - stat.mtimeMs < STALE_QUERY_RESULT_FILE_AGE_MS) continue;
      fs.rmSync(resultPath, { force: true });
      removedCount += 1;
    } catch (_err) {
      // Startup cleanup is best effort and must not block database startup.
    }
  }

  return removedCount;
}

module.exports = {
  cancelQueryResult,
  cleanupStaleQueryResultFiles,
  isQueryCancelled,
  removeQueryResultFile,
  writeQueryResultFile,
  STALE_QUERY_RESULT_FILE_AGE_MS
};
