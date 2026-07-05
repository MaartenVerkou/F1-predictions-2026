"use strict";

const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SCRIPT_PATH = path.join(ROOT, "scripts", "backfill-actuals-2026.js");

function runActualsAutoUpdate({
  season,
  dbPath,
  databaseUrl,
  dataDir,
  questionsPath,
  rosterPath,
  racesPath,
  dryRun = false,
  maxRound = null,
  extraEnv = {}
} = {}) {
  const args = [SCRIPT_PATH, dryRun ? "--dry-run" : "--apply"];
  if (Number.isFinite(Number(season)) && Number(season) > 0) {
    args.push(`--season=${Number(season)}`);
  }
  if (dbPath) {
    args.push(`--db=${dbPath}`);
  }
  if (maxRound != null && Number.isFinite(Number(maxRound)) && Number(maxRound) > 0) {
    args.push(`--max-round=${Math.floor(Number(maxRound))}`);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
        ...(dbPath ? { DB_PATH: dbPath } : {}),
        ...(dataDir ? { DATA_DIR: dataDir } : {}),
        ...(questionsPath ? { QUESTIONS_PATH: questionsPath } : {}),
        ...(rosterPath ? { ROSTER_PATH: rosterPath } : {}),
        ...(racesPath ? { RACES_PATH: racesPath } : {}),
        ...extraEnv
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        const detail = String(stderr || stdout || `actuals updater exited with code ${code}`).trim();
        reject(new Error(detail));
        return;
      }
      const output = String(stdout || "").trim();
      if (!output) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(output));
      } catch (err) {
        reject(
          new Error(
            `Failed to parse actuals updater output: ${err.message}`
          )
        );
      }
    });
  });
}

module.exports = {
  SCRIPT_PATH,
  runActualsAutoUpdate
};
