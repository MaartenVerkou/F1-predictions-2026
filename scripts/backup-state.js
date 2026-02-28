#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");
let Database;
try {
  Database = require("better-sqlite3");
} catch (err) {
  console.error(
    "Missing dependency 'better-sqlite3'. Run this script inside the app container (sh ./scripts/run-backup.sh) or install dependencies."
  );
  process.exit(1);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || "");
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value == null || String(value).startsWith("--")) {
      out[key] = "1";
      continue;
    }
    out[key] = String(value);
    i += 1;
  }
  return out;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function timestamp() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}Z`;
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  const buf = fs.readFileSync(filePath);
  hash.update(buf);
  return hash.digest("hex");
}

async function gzipFile(inputPath, outputPath) {
  await pipeline(
    fs.createReadStream(inputPath),
    zlib.createGzip({ level: 9 }),
    fs.createWriteStream(outputPath)
  );
}

function pruneBackups(outputDir, prefix, keepDays, keepCount) {
  const files = fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith(".sqlite.gz"))
    .map((name) => {
      const fullPath = path.join(outputDir, name);
      const stat = fs.statSync(fullPath);
      return {
        name,
        fullPath,
        mtimeMs: stat.mtimeMs
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const now = Date.now();
  const maxAgeMs = Math.max(0, keepDays) * 24 * 60 * 60 * 1000;
  const toDelete = [];

  for (let i = 0; i < files.length; i += 1) {
    const f = files[i];
    const tooOld = maxAgeMs > 0 && now - f.mtimeMs > maxAgeMs;
    const tooMany = i >= keepCount;
    if (tooOld || tooMany) toDelete.push(f.fullPath);
  }

  for (const filePath of toDelete) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.warn(`Warning: failed to delete old backup ${filePath}: ${err.message}`);
    }
  }

  const metaFiles = fs
    .readdirSync(outputDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.startsWith(`${prefix}-meta-`) && name.endsWith(".json"))
    .map((name) => {
      const fullPath = path.join(outputDir, name);
      const stat = fs.statSync(fullPath);
      return {
        fullPath,
        mtimeMs: stat.mtimeMs
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const metaToDelete = [];
  for (let i = 0; i < metaFiles.length; i += 1) {
    const f = metaFiles[i];
    const tooOld = maxAgeMs > 0 && now - f.mtimeMs > maxAgeMs;
    const tooMany = i >= keepCount;
    if (tooOld || tooMany) metaToDelete.push(f.fullPath);
  }

  for (const filePath of metaToDelete) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.warn(
        `Warning: failed to delete old metadata backup ${filePath}: ${err.message}`
      );
    }
  }

  return {
    backupFilesDeleted: toDelete.length,
    metadataFilesDeleted: metaToDelete.length
  };
}

async function backupOneDb({ dbPath, outputDir, prefix, ts, label }) {
  if (!fs.existsSync(dbPath)) {
    return null;
  }
  const tempSqlite = path.join(outputDir, `${prefix}-${label}-${ts}.sqlite`);
  const finalGzip = `${tempSqlite}.gz`;
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    await db.backup(tempSqlite);
  } finally {
    db.close();
  }
  await gzipFile(tempSqlite, finalGzip);
  fs.unlinkSync(tempSqlite);

  const stat = fs.statSync(finalGzip);
  return {
    file: path.basename(finalGzip),
    fullPath: finalGzip,
    sizeBytes: stat.size,
    sha256: sha256(finalGzip)
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(
    args.out || process.env.BACKUP_OUT_DIR || path.join(process.cwd(), "backups")
  );
  const keepDays = Number(args["keep-days"] || process.env.BACKUP_KEEP_DAYS || 30);
  const keepCount = Number(args["keep-count"] || process.env.BACKUP_KEEP_COUNT || 90);
  const prefix = String(args.prefix || process.env.BACKUP_PREFIX || "f1predictions");
  const appDbPath = path.resolve(
    args["app-db"] || process.env.BACKUP_APP_DB || process.env.DB_PATH || "/app/state/app.db"
  );
  const sessionsDbPath = path.resolve(
    args["sessions-db"] ||
      process.env.BACKUP_SESSIONS_DB ||
      "/app/state/sessions.db"
  );

  ensureDir(outputDir);
  const ts = timestamp();

  const artifacts = [];
  const appDb = await backupOneDb({
    dbPath: appDbPath,
    outputDir,
    prefix,
    ts,
    label: "app"
  });
  if (appDb) artifacts.push(appDb);

  const sessionsDb = await backupOneDb({
    dbPath: sessionsDbPath,
    outputDir,
    prefix,
    ts,
    label: "sessions"
  });
  if (sessionsDb) artifacts.push(sessionsDb);

  if (artifacts.length === 0) {
    throw new Error("No database files found to back up.");
  }

  const metadata = {
    createdAt: new Date().toISOString(),
    prefix,
    keepDays,
    keepCount,
    files: artifacts.map((a) => ({
      file: a.file,
      sizeBytes: a.sizeBytes,
      sha256: a.sha256
    }))
  };
  const metaPath = path.join(outputDir, `${prefix}-meta-${ts}.json`);
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), "utf8");

  const pruned = pruneBackups(outputDir, prefix, keepDays, keepCount);

  console.log(`Backup complete (${artifacts.length} database file(s)).`);
  for (const artifact of artifacts) {
    console.log(`- ${artifact.file} (${artifact.sizeBytes} bytes)`);
  }
  console.log(`Metadata: ${path.basename(metaPath)}`);
  console.log(`Pruned old backup files: ${pruned.backupFilesDeleted}`);
  console.log(`Pruned old metadata files: ${pruned.metadataFilesDeleted}`);
}

main().catch((err) => {
  console.error(`Backup failed: ${err.message}`);
  process.exit(1);
});
