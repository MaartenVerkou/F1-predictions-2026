"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { test } = require("node:test");
const Database = require("better-sqlite3");

const ROOT = path.resolve(__dirname, "..");

async function getOpenPort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  return port;
}

class TestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  storeCookies(setCookieHeaders) {
    for (const header of setCookieHeaders || []) {
      const [pair] = String(header).split(";");
      const separator = pair.indexOf("=");
      if (separator > 0) {
        this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
    }
  }

  request(method, targetPath, { form = null, headers = {} } = {}) {
    const url = new URL(targetPath, this.baseUrl);
    const body = form ? new URLSearchParams(form).toString() : "";
    const requestHeaders = {
      ...headers
    };
    const cookie = this.cookieHeader();
    if (cookie) requestHeaders.cookie = cookie;
    if (form) {
      requestHeaders["content-type"] = "application/x-www-form-urlencoded";
      requestHeaders["content-length"] = Buffer.byteLength(body);
    }

    return new Promise((resolve, reject) => {
      const req = http.request(
        url,
        {
          method,
          headers: requestHeaders
        },
        (res) => {
          let responseBody = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            responseBody += chunk;
          });
          res.on("end", () => {
            this.storeCookies(res.headers["set-cookie"]);
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: responseBody
            });
          });
        }
      );
      req.on("error", reject);
      if (body) req.write(body);
      req.end();
    });
  }

  get(targetPath, options) {
    return this.request("GET", targetPath, options);
  }

  post(targetPath, options) {
    return this.request("POST", targetPath, options);
  }
}

function extractInputValue(html, name) {
  const pattern = new RegExp(`name="${name}" value="([^"]*)"`);
  const match = String(html || "").match(pattern);
  assert.ok(match, `expected hidden input ${name}`);
  return match[1];
}

function extractCsrfToken(html) {
  return extractInputValue(html, "_csrf");
}

function extractNamedGuestResumeToken(html) {
  const match = String(html || "").match(/data-named-guest-resume-token="([^"]+)"/);
  assert.ok(match, "expected named guest resume token on page");
  return match[1];
}

async function startTestServer(t) {
  const port = await getOpenPort();
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "f1-security-"));
  const dbPath = path.join(stateDir, "app.db");
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      DATA_DIR: stateDir,
      DB_PATH: dbPath,
      QUESTIONS_PATH: path.join(ROOT, "data", "questions.json"),
      ROSTER_PATH: path.join(ROOT, "data", "roster.json"),
      RACES_PATH: path.join(ROOT, "data", "races.json"),
      LAST_SEASON_RESULTS_PATH: path.join(ROOT, "data", "last-season-results.json"),
      SESSION_SECRET: "security-flow-session-secret",
      LOG_LEVEL: "error",
      ADMIN_EMAILS: "dev@example.com",
      DEV_AUTO_LOGIN: "1",
      DEV_AUTO_LOGIN_EMAIL: "dev@example.com",
      DEV_AUTO_LOGIN_NAME: "Dev Admin",
      PREDICTIONS_CLOSE_AT: "2099-03-05T23:59:59"
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

  const baseUrl = `http://127.0.0.1:${port}`;
  const client = new TestClient(baseUrl);
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`server exited early with code ${child.exitCode}: ${stderr}`);
    }
    try {
      const health = await client.get("/healthz");
      if (health.statusCode === 200) {
        return { baseUrl, client, dbPath };
      }
    } catch (err) {
      // server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`server did not become healthy: ${stderr}`);
}

function seedInvitedGroup(db, { groupId = 880001, code = "SECJOIN1" } = {}) {
  const now = new Date().toISOString();
  const owner = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get("owner-security@example.local");
  const ownerId =
    owner?.id ||
    db
      .prepare(
        "INSERT INTO users (name, email, password_hash, created_at, is_verified, verified_at, is_admin, is_simulated) VALUES (?, ?, ?, ?, 1, ?, 0, 0)"
      )
      .run("Security Owner", "owner-security@example.local", "test-hash", now, now).lastInsertRowid;
  db.prepare(
    "INSERT INTO groups (id, name, owner_id, created_at, join_code, join_password_hash, is_public, is_global, invite_link_open) VALUES (?, ?, ?, ?, NULL, NULL, 1, 0, 1)"
  ).run(groupId, `Security Group ${groupId}`, ownerId, now);
  db.prepare(
    "INSERT INTO invites (group_id, code, created_at, created_by) VALUES (?, ?, ?, ?)"
  ).run(groupId, code, now, ownerId);
  return { groupId, code };
}

async function switchToVisitor(client) {
  const home = await client.get("/");
  assert.equal(home.statusCode, 200);
  const csrfToken = extractCsrfToken(home.body);
  const response = await client.post("/dev/switch-user", {
    form: {
      _csrf: csrfToken,
      mode: "visitor",
      redirectTo: "/"
    }
  });
  assert.equal(response.statusCode, 302);
}

test("opening an invite with GET does not add the authenticated user to the group", async (t) => {
  const { client, dbPath } = await startTestServer(t);

  await client.get("/");

  const db = new Database(dbPath);
  const currentUser = db.prepare("SELECT id FROM users WHERE email = ?").get("dev@example.com");
  assert.ok(currentUser);
  const { groupId, code } = seedInvitedGroup(db);

  const response = await client.get(`/join/${code}`);
  assert.equal(response.statusCode, 200);

  const membership = db
    .prepare("SELECT 1 FROM group_members WHERE user_id = ? AND group_id = ?")
    .get(currentUser.id, groupId);
  db.close();

  assert.equal(membership, undefined);
});

test("invite membership requires explicit POST with a valid CSRF token", async (t) => {
  const { client, dbPath } = await startTestServer(t);

  await client.get("/");

  const db = new Database(dbPath);
  const currentUser = db.prepare("SELECT id FROM users WHERE email = ?").get("dev@example.com");
  assert.ok(currentUser);
  const { groupId, code } = seedInvitedGroup(db, {
    groupId: 880002,
    code: "SECJOIN2"
  });

  const joinPage = await client.get(`/join/${code}`);
  assert.equal(joinPage.statusCode, 200);
  const csrfToken = extractCsrfToken(joinPage.body);

  const rejected = await client.post(`/join/${code}`, { form: {} });
  assert.equal(rejected.statusCode, 403);
  assert.equal(
    db.prepare("SELECT 1 FROM group_members WHERE user_id = ? AND group_id = ?").get(currentUser.id, groupId),
    undefined
  );

  const accepted = await client.post(`/join/${code}`, {
    form: {
      _csrf: csrfToken
    }
  });
  assert.equal(accepted.statusCode, 302);
  assert.ok(
    db.prepare("SELECT 1 FROM group_members WHERE user_id = ? AND group_id = ?").get(currentUser.id, groupId)
  );
  db.close();
});

test("admin mutation rejects missing CSRF and accepts a rendered token", async (t) => {
  const { client, dbPath } = await startTestServer(t);

  await client.get("/");

  const db = new Database(dbPath);
  const now = new Date().toISOString();
  const userId = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, created_at, is_verified, verified_at, is_admin, is_simulated, hide_from_global) VALUES (?, ?, ?, ?, 1, ?, 0, 0, 0)"
    )
    .run("CSRF Target", "csrf-target@example.local", "test-hash", now, now).lastInsertRowid;

  const rejected = await client.post(`/admin/users/${userId}/hide-from-global`, {
    form: {
      hideFromGlobal: "1",
      returnTo: "/admin/overview#admin-users"
    }
  });
  assert.equal(rejected.statusCode, 403);
  assert.equal(db.prepare("SELECT hide_from_global FROM users WHERE id = ?").get(userId).hide_from_global, 0);

  const adminPage = await client.get("/admin/overview");
  assert.equal(adminPage.statusCode, 200);
  const csrfToken = extractCsrfToken(adminPage.body);
  const accepted = await client.post(`/admin/users/${userId}/hide-from-global`, {
    form: {
      _csrf: csrfToken,
      hideFromGlobal: "1",
      returnTo: "/admin/overview#admin-users"
    }
  });
  assert.equal(accepted.statusCode, 302);
  assert.equal(db.prepare("SELECT hide_from_global FROM users WHERE id = ?").get(userId).hide_from_global, 1);
  db.close();
});

test("named guest return requires the private resume token", async (t) => {
  const { baseUrl, client, dbPath } = await startTestServer(t);
  await switchToVisitor(client);

  const db = new Database(dbPath);
  const { groupId, code } = seedInvitedGroup(db, {
    groupId: 880003,
    code: "SECJOIN3"
  });

  const joinPage = await client.get(`/join/${code}`);
  assert.equal(joinPage.statusCode, 200);
  const joinCsrf = extractCsrfToken(joinPage.body);
  const joined = await client.post(`/join/${code}/guest`, {
    form: {
      _csrf: joinCsrf,
      guestName: "Guest One"
    }
  });
  assert.equal(joined.statusCode, 302);

  const questionsPage = await client.get(`/join/${code}/questions`);
  assert.equal(questionsPage.statusCode, 200);
  const resumeToken = extractNamedGuestResumeToken(questionsPage.body);

  const profile = db
    .prepare("SELECT guest_id, resume_token_hash FROM named_guest_profiles WHERE display_name = ?")
    .get("Guest One");
  assert.ok(profile);
  assert.notEqual(profile.resume_token_hash, resumeToken);
  assert.match(profile.resume_token_hash, /^[a-f0-9]{64}$/);

  const secondClient = new TestClient(baseUrl);
  await switchToVisitor(secondClient);
  const returningPage = await secondClient.get(`/join/${code}?mode=returning`);
  assert.equal(returningPage.statusCode, 200);
  const returningCsrf = extractCsrfToken(returningPage.body);

  const rejected = await secondClient.post(`/join/${code}/guest/return`, {
    form: {
      _csrf: returningCsrf,
      returnGuestName: "Guest One"
    }
  });
  assert.equal(rejected.statusCode, 400);
  assert.match(rejected.body, /return token/i);

  const accepted = await secondClient.post(`/join/${code}/guest/return`, {
    form: {
      _csrf: returningCsrf,
      returnGuestName: "Guest One",
      resumeToken
    }
  });
  assert.equal(accepted.statusCode, 302);

  const resumedQuestions = await secondClient.get(`/join/${code}/questions`);
  assert.equal(resumedQuestions.statusCode, 200);
  assert.ok(
    db.prepare("SELECT 1 FROM named_guest_group_members WHERE group_id = ? AND guest_id = ?").get(groupId, profile.guest_id)
  );
  db.close();
});

test("repeated login failures are throttled", async (t) => {
  const { client } = await startTestServer(t);

  const loginPage = await client.get("/login");
  assert.equal(loginPage.statusCode, 200);
  const csrfToken = extractCsrfToken(loginPage.body);
  let response = null;
  for (let attempt = 0; attempt < 9; attempt += 1) {
    response = await client.post("/login", {
      form: {
        _csrf: csrfToken,
        email: "missing@example.local",
        password: "not-the-password"
      }
    });
  }
  assert.equal(response.statusCode, 429);
});
