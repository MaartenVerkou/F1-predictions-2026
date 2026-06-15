"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { test } = require("node:test");

const ROOT = path.resolve(__dirname, "..");

async function getOpenPort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  return port;
}

function requestJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body)
          });
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on("error", reject);
  });
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }
    try {
      const response = await requestJson(url);
      if (response.statusCode === 200) return response;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw lastError || new Error("server did not become healthy");
}

test("health endpoint reports readiness and echoes request id", async (t) => {
  const port = await getOpenPort();
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "f1-health-"));
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      DATA_DIR: stateDir,
      DB_PATH: path.join(stateDir, "app.db"),
      QUESTIONS_PATH: path.join(ROOT, "data", "questions.json"),
      ROSTER_PATH: path.join(ROOT, "data", "roster.json"),
      RACES_PATH: path.join(ROOT, "data", "races.json"),
      LAST_SEASON_RESULTS_PATH: path.join(ROOT, "data", "last-season-results.json"),
      SESSION_SECRET: "test-session-secret",
      LOG_LEVEL: "error"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  t.after(async () => {
    if (child.exitCode == null) {
      child.kill();
      await new Promise((resolve) => child.once("exit", resolve));
    }
    fs.rmSync(stateDir, { recursive: true, force: true });
  });

  const url = `http://127.0.0.1:${port}/healthz`;
  await waitForHealth(url, child);
  const response = await requestJson(url, { "x-request-id": "test-request-1" });

  assert.equal(response.statusCode, 200, stderr);
  assert.equal(response.headers["x-request-id"], "test-request-1");
  assert.equal(response.body.status, "ok");
  assert.equal(response.body.checks.database, "ok");
  assert.equal(response.body.service, "f1-predictions-2026");
});
