"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INCLUDE_DIRS = ["server.js", "src", "scripts", "public", "tests", "playwright.config.js"];
const SKIP_DIRS = new Set([
  ".codex",
  ".git",
  ".github",
  ".tmp",
  "backups",
  "blob-report",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results"
]);

function collectJsFiles(entry, files = []) {
  if (!fs.existsSync(entry)) return files;
  const stat = fs.statSync(entry);
  if (stat.isFile()) {
    if (entry.endsWith(".js")) files.push(entry);
    return files;
  }
  if (!stat.isDirectory()) return files;

  const name = path.basename(entry);
  if (SKIP_DIRS.has(name)) return files;

  for (const child of fs.readdirSync(entry)) {
    collectJsFiles(path.join(entry, child), files);
  }
  return files;
}

const files = INCLUDE_DIRS.flatMap((entry) => collectJsFiles(path.join(ROOT, entry)));
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: ROOT,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`Checked ${files.length} JavaScript files.`);
