"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { test } = require("node:test");
const bcrypt = require("bcrypt");
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

function getSessionSetCookieHeader(response) {
  const headers = response?.headers?.["set-cookie"] || [];
  return headers.find((header) => String(header).startsWith("connect.sid=")) || "";
}

function getCookieTtlMs(setCookieHeader, nowMs = Date.now()) {
  const maxAgeMatch = String(setCookieHeader || "").match(/;\s*max-age=(\d+)/i);
  if (maxAgeMatch) return Number(maxAgeMatch[1]) * 1000;
  const expiresMatch = String(setCookieHeader || "").match(/;\s*expires=([^;]+)/i);
  assert.ok(expiresMatch, "expected persistent cookie expiry");
  const expiresAt = new Date(expiresMatch[1]).getTime();
  assert.ok(Number.isFinite(expiresAt), "expected valid cookie expiry");
  return expiresAt - nowMs;
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

function hashToken(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function hashClaimPin(value) {
  return hashToken(`named-guest-claim:pin:${String(value || "").trim()}`);
}

function addDevAdminToGroup(db, groupId) {
  const now = new Date().toISOString();
  const currentUser = db.prepare("SELECT id FROM users WHERE email = ?").get("dev@example.com");
  assert.ok(currentUser);
  db.prepare(
    "INSERT OR IGNORE INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, 'admin', ?)"
  ).run(currentUser.id, groupId, now);
  return currentUser.id;
}

function seedNamedGuest(db, { guestId, displayName, groupId, pin = "1111" }) {
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO named_guest_profiles (guest_id, display_name, source_group_id, claim_secret_hash, claim_secret_mode, claim_secret_set_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'pin', ?, ?, ?)"
  ).run(guestId, displayName, groupId, hashClaimPin(pin), now, now, now);
  db.prepare(
    "INSERT INTO named_guest_group_members (group_id, guest_id, display_name, joined_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(groupId, guestId, displayName, now, now);
}

function insertRecoveryToken(
  db,
  { token, guestId, groupId, action, targetEmail, targetUserId = null, createdByUserId, expiresAt = null }
) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO named_guest_recovery_tokens (
      guest_id, group_id, token_hash, action, target_email, target_user_id,
      created_by_user_id, created_at, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    guestId,
    groupId,
    hashToken(token),
    action,
    targetEmail,
    targetUserId,
    createdByUserId,
    now,
    expiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString()
  );
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

test("named guest claim requires the private recovery answer", async (t) => {
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
      guestName: "Guest One",
      claimSecretMode: "pin",
      claimPin: "4726"
    }
  });
  assert.equal(joined.statusCode, 302);

  const questionsPage = await client.get(`/join/${code}/questions`);
  assert.equal(questionsPage.statusCode, 200);

  const profile = db
    .prepare("SELECT guest_id, claim_secret_hash, claim_secret_mode FROM named_guest_profiles WHERE display_name = ?")
    .get("Guest One");
  assert.ok(profile);
  assert.equal(profile.claim_secret_mode, "pin");
  assert.notEqual(profile.claim_secret_hash, "4726");
  assert.match(profile.claim_secret_hash, /^[a-f0-9]{64}$/);

  const secondClient = new TestClient(baseUrl);
  await switchToVisitor(secondClient);
  const returningPage = await secondClient.get(`/join/${code}?mode=returning`);
  assert.equal(returningPage.statusCode, 200);
  assert.match(returningPage.body, /Guest One/);
  const returningCsrf = extractCsrfToken(returningPage.body);

  const rejected = await secondClient.post(`/join/${code}/guest/return`, {
    form: {
      _csrf: returningCsrf,
      returnGuestId: profile.guest_id
    }
  });
  assert.equal(rejected.statusCode, 400);
  assert.match(rejected.body, /Recovery/i);

  const wrongSecret = await secondClient.post(`/join/${code}/guest/return`, {
    form: {
      _csrf: returningCsrf,
      returnGuestId: profile.guest_id,
      claimSecret: "0000"
    }
  });
  assert.equal(wrongSecret.statusCode, 400);
  assert.match(wrongSecret.body, /recovery/i);

  const accepted = await secondClient.post(`/join/${code}/guest/return`, {
    form: {
      _csrf: returningCsrf,
      returnGuestId: profile.guest_id,
      claimSecret: "4726"
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

test("named guest remember-device toggle can use a session-only browser cookie", async (t) => {
  const { client, dbPath } = await startTestServer(t);
  await switchToVisitor(client);

  const db = new Database(dbPath);
  const { code } = seedInvitedGroup(db, {
    groupId: 880014,
    code: "SECJOIN14"
  });

  const joinPage = await client.get(`/join/${code}`);
  assert.equal(joinPage.statusCode, 200);
  assert.match(joinPage.body, /name="rememberDevice" value="0"/);
  assert.match(joinPage.body, /name="rememberDevice" value="1" checked/);
  const joinCsrf = extractCsrfToken(joinPage.body);

  const joined = await client.post(`/join/${code}/guest`, {
    form: {
      _csrf: joinCsrf,
      guestName: "Session Only Guest",
      claimSecretMode: "pin",
      claimPin: "8273",
      rememberDevice: "0"
    }
  });
  assert.equal(joined.statusCode, 302);
  const sessionCookie = getSessionSetCookieHeader(joined);
  assert.ok(sessionCookie);
  assert.doesNotMatch(sessionCookie, /expires=/i);
  assert.doesNotMatch(sessionCookie, /max-age=/i);

  const questionsPage = await client.get(`/join/${code}/questions`);
  assert.equal(questionsPage.statusCode, 200);

  db.close();
});

test("named guest remember-device default uses a 30 day browser cookie", async (t) => {
  const { client, dbPath } = await startTestServer(t);
  await switchToVisitor(client);

  const db = new Database(dbPath);
  const { code } = seedInvitedGroup(db, {
    groupId: 880015,
    code: "SECJOIN15"
  });

  const joinPage = await client.get(`/join/${code}`);
  assert.equal(joinPage.statusCode, 200);
  const joinCsrf = extractCsrfToken(joinPage.body);

  const beforeJoinMs = Date.now();
  const joined = await client.post(`/join/${code}/guest`, {
    form: {
      _csrf: joinCsrf,
      guestName: "Remembered Guest",
      claimSecretMode: "pin",
      claimPin: "8273",
      rememberDevice: "1"
    }
  });
  assert.equal(joined.statusCode, 302);
  const sessionCookie = getSessionSetCookieHeader(joined);
  assert.ok(sessionCookie);
  const ttlMs = getCookieTtlMs(sessionCookie, beforeJoinMs);
  assert.ok(ttlMs >= 1000 * 60 * 60 * 24 * 29);
  assert.ok(ttlMs <= 1000 * 60 * 60 * 24 * 31);

  db.close();
});

test("named guest can skip self-recovery and must use admin recovery later", async (t) => {
  const { baseUrl, client, dbPath } = await startTestServer(t);
  await switchToVisitor(client);

  const db = new Database(dbPath);
  const { code } = seedInvitedGroup(db, {
    groupId: 880011,
    code: "SECJOIN11"
  });

  const joinPage = await client.get(`/join/${code}`);
  assert.equal(joinPage.statusCode, 200);
  const joinCsrf = extractCsrfToken(joinPage.body);
  const joined = await client.post(`/join/${code}/guest`, {
    form: {
      _csrf: joinCsrf,
      guestName: "No Recovery Guest",
      skipRecoverySecret: "1"
    }
  });
  assert.equal(joined.statusCode, 302);

  const questionsPage = await client.get(`/join/${code}/questions`);
  assert.equal(questionsPage.statusCode, 200);
  const profile = db
    .prepare("SELECT guest_id, claim_secret_hash FROM named_guest_profiles WHERE display_name = ?")
    .get("No Recovery Guest");
  assert.ok(profile);
  assert.equal(profile.claim_secret_hash, null);

  const secondClient = new TestClient(baseUrl);
  await switchToVisitor(secondClient);
  const returningPage = await secondClient.get(`/join/${code}?mode=returning`);
  assert.equal(returningPage.statusCode, 200);
  assert.match(returningPage.body, /No Recovery Guest/);
  const returningCsrf = extractCsrfToken(returningPage.body);
  const rejected = await secondClient.post(`/join/${code}/guest/return`, {
    form: {
      _csrf: returningCsrf,
      returnGuestId: profile.guest_id,
      claimSecret: "1234"
    }
  });
  assert.equal(rejected.statusCode, 400);
  assert.match(rejected.body, /group owner\/admin/i);
  db.close();
});

test("legacy named guest sets guest recovery before continuing", async (t) => {
  const { client, dbPath } = await startTestServer(t);
  await switchToVisitor(client);

  const db = new Database(dbPath);
  const { code, groupId } = seedInvitedGroup(db, {
    groupId: 880004,
    code: "SECJOIN4"
  });
  const now = new Date().toISOString();
  const guestId = "legacy-guest-1";
  const resumeToken = "legacy-return-token";
  db.prepare(
    "INSERT INTO named_guest_profiles (guest_id, display_name, source_group_id, resume_token_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(guestId, "Legacy Guest", groupId, hashToken(resumeToken), now, now);
  db.prepare(
    "INSERT INTO named_guest_group_members (group_id, guest_id, display_name, joined_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(groupId, guestId, "Legacy Guest", now, now);

  const returningPage = await client.get(`/join/${code}?mode=returning`);
  assert.equal(returningPage.statusCode, 200);
  const returningCsrf = extractCsrfToken(returningPage.body);
  const resumed = await client.post(`/join/${code}/guest/return`, {
    form: {
      _csrf: returningCsrf,
      returnGuestId: guestId,
      claimSecret: resumeToken
    }
  });
  assert.equal(resumed.statusCode, 302);
  assert.equal(resumed.headers.location, `/join/${code}/claim-secret`);

  const setupPage = await client.get(`/join/${code}/claim-secret`);
  assert.equal(setupPage.statusCode, 200);
  assert.match(setupPage.body, /Guest recovery/i);
  const setupCsrf = extractCsrfToken(setupPage.body);
  const saved = await client.post(`/join/${code}/claim-secret`, {
    form: {
      _csrf: setupCsrf,
      claimSecretMode: "pin",
      claimPin: "7142"
    }
  });
  assert.equal(saved.statusCode, 302);

  const questionsPage = await client.get(`/join/${code}/questions`);
  assert.equal(questionsPage.statusCode, 200);
  const profile = db
    .prepare("SELECT claim_secret_hash, claim_secret_mode FROM named_guest_profiles WHERE guest_id = ?")
    .get(guestId);
  assert.equal(profile.claim_secret_mode, "pin");
  assert.match(profile.claim_secret_hash, /^[a-f0-9]{64}$/);
  db.close();
});

test("private invite shows named guest picker only after group password access", async (t) => {
  const { client, dbPath } = await startTestServer(t);
  await switchToVisitor(client);

  const db = new Database(dbPath);
  const { code, groupId } = seedInvitedGroup(db, {
    groupId: 880005,
    code: "SECJOIN5"
  });
  db.prepare("UPDATE groups SET is_public = 0, join_password_hash = ? WHERE id = ?")
    .run(bcrypt.hashSync("secret", 10), groupId);
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO named_guest_profiles (guest_id, display_name, source_group_id, claim_secret_hash, claim_secret_mode, claim_secret_set_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    "private-guest-1",
    "Private Guest",
    groupId,
    hashToken("named-guest-claim:pin:4567"),
    "pin",
    now,
    now,
    now
  );
  db.prepare(
    "INSERT INTO named_guest_group_members (group_id, guest_id, display_name, joined_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(groupId, "private-guest-1", "Private Guest", now, now);

  const lockedPage = await client.get(`/join/${code}?mode=returning`);
  assert.equal(lockedPage.statusCode, 200);
  assert.doesNotMatch(lockedPage.body, /Private Guest/);
  const accessCsrf = extractCsrfToken(lockedPage.body);
  const unlocked = await client.post(`/join/${code}/access`, {
    form: {
      _csrf: accessCsrf,
      password: "secret"
    }
  });
  assert.equal(unlocked.statusCode, 302);

  const unlockedPage = await client.get(`/join/${code}?mode=returning`);
  assert.equal(unlockedPage.statusCode, 200);
  assert.match(unlockedPage.body, /Private Guest/);
  db.close();
});

test("shared browser requires explicit continue before reusing named guest", async (t) => {
  const { client, dbPath } = await startTestServer(t);
  await switchToVisitor(client);

  const db = new Database(dbPath);
  const first = seedInvitedGroup(db, {
    groupId: 880006,
    code: "SECJOIN6"
  });
  const second = seedInvitedGroup(db, {
    groupId: 880007,
    code: "SECJOIN7"
  });

  const firstJoinPage = await client.get(`/join/${first.code}`);
  const firstCsrf = extractCsrfToken(firstJoinPage.body);
  const joined = await client.post(`/join/${first.code}/guest`, {
    form: {
      _csrf: firstCsrf,
      guestName: "Shared Guest",
      claimSecretMode: "pin",
      claimPin: "2468"
    }
  });
  assert.equal(joined.statusCode, 302);

  const secondJoinPage = await client.get(`/join/${second.code}`);
  assert.equal(secondJoinPage.statusCode, 200);
  assert.match(secondJoinPage.body, /Continue as Shared Guest/);
  assert.equal(
    db
      .prepare("SELECT 1 FROM named_guest_group_members WHERE group_id = ? AND display_name = ?")
      .get(second.groupId, "Shared Guest"),
    undefined
  );

  const continueCsrf = extractCsrfToken(secondJoinPage.body);
  const continued = await client.post(`/join/${second.code}/guest/continue-current`, {
    form: {
      _csrf: continueCsrf
    }
  });
  assert.equal(continued.statusCode, 302);
  assert.ok(
    db
      .prepare("SELECT 1 FROM named_guest_group_members WHERE group_id = ? AND display_name = ?")
      .get(second.groupId, "Shared Guest")
  );
  db.close();
});

test("guest conversion reviews conflicts and can keep account predictions", async (t) => {
  const { client, dbPath } = await startTestServer(t);
  await switchToVisitor(client);

  const db = new Database(dbPath);
  const { code, groupId } = seedInvitedGroup(db, {
    groupId: 880008,
    code: "SECJOIN8"
  });
  const now = new Date().toISOString();
  const userId = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, created_at, is_verified, verified_at, is_admin, is_simulated) VALUES (?, ?, ?, ?, 1, ?, 0, 0)"
    )
    .run(
      "Account Sam",
      "account-sam@example.local",
      bcrypt.hashSync("secret-pass", 12),
      now,
      now
    ).lastInsertRowid;
  db.prepare(
    "INSERT INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, 'member', ?)"
  ).run(userId, groupId, now);
  db.prepare(
    "INSERT INTO responses (user_id, group_id, question_id, answer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(userId, groupId, "drivers_championship_top_3", "account-answer", now, now);

  const joinPage = await client.get(`/join/${code}`);
  const joinCsrf = extractCsrfToken(joinPage.body);
  const joined = await client.post(`/join/${code}/guest`, {
    form: {
      _csrf: joinCsrf,
      guestName: "Guest Sam",
      claimSecretMode: "pin",
      claimPin: "8642"
    }
  });
  assert.equal(joined.statusCode, 302);
  const guest = db
    .prepare("SELECT guest_id FROM named_guest_profiles WHERE display_name = ?")
    .get("Guest Sam");
  db.prepare(
    "INSERT INTO guest_responses (guest_id, group_id, question_id, answer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(guest.guest_id, groupId, "drivers_championship_top_3", "guest-answer", now, now);

  const loginPage = await client.get("/login");
  const loginCsrf = extractCsrfToken(loginPage.body);
  const loggedIn = await client.post("/login", {
    form: {
      _csrf: loginCsrf,
      email: "account-sam@example.local",
      password: "secret-pass"
    }
  });
  assert.equal(loggedIn.statusCode, 302);
  assert.equal(loggedIn.headers.location, "/guest-conversion");

  const conversionPage = await client.get("/guest-conversion");
  assert.equal(conversionPage.statusCode, 200);
  assert.match(conversionPage.body, /Keep my account predictions for this group/);
  const conversionCsrf = extractCsrfToken(conversionPage.body);
  const converted = await client.post("/guest-conversion", {
    form: {
      _csrf: conversionCsrf,
      guestId: guest.guest_id,
      [`group_${groupId}`]: "account"
    }
  });
  assert.equal(converted.statusCode, 302);
  assert.equal(
    db
      .prepare("SELECT answer FROM responses WHERE user_id = ? AND group_id = ? AND question_id = ?")
      .get(userId, groupId, "drivers_championship_top_3").answer,
    "account-answer"
  );
  assert.equal(
    db.prepare("SELECT 1 FROM named_guest_group_members WHERE guest_id = ?").get(guest.guest_id),
    undefined
  );
  assert.equal(
    db.prepare("SELECT 1 FROM guest_responses WHERE guest_id = ?").get(guest.guest_id),
    undefined
  );
  db.close();
});

test("owner recovery reset uses email token confirmation without revealing recovery PINs", async (t) => {
  const { client, dbPath } = await startTestServer(t);

  await client.get("/");

  const db = new Database(dbPath);
  const { groupId } = seedInvitedGroup(db, {
    groupId: 880009,
    code: "SECJOIN9"
  });
  const adminUserId = addDevAdminToGroup(db, groupId);
  seedNamedGuest(db, {
    guestId: "reset-guest-1",
    displayName: "Reset Guest",
    groupId,
    pin: "1111"
  });
  const originalHash = db
    .prepare("SELECT claim_secret_hash FROM named_guest_profiles WHERE guest_id = ?")
    .get("reset-guest-1").claim_secret_hash;

  const groupPage = await client.get(`/groups/${groupId}`);
  assert.equal(groupPage.statusCode, 200);
  assert.match(groupPage.body, /Reset recovery/);
  assert.match(groupPage.body, /Propose transfer/);
  assert.doesNotMatch(groupPage.body, /1111/);
  assert.doesNotMatch(groupPage.body, new RegExp(originalHash.slice(0, 16)));
  const groupCsrf = extractCsrfToken(groupPage.body);

  const proposed = await client.post(`/groups/${groupId}/named-guests/reset-guest-1/reset-secret`, {
    form: {
      _csrf: groupCsrf,
      targetEmail: "reset-person@example.local"
    }
  });
  assert.equal(proposed.statusCode, 302);
  const proposal = db
    .prepare("SELECT * FROM named_guest_recovery_tokens WHERE action = 'reset_secret' ORDER BY id DESC LIMIT 1")
    .get();
  assert.equal(proposal.guest_id, "reset-guest-1");
  assert.equal(proposal.target_email, "reset-person@example.local");
  assert.equal(proposal.created_by_user_id, adminUserId);
  assert.match(proposal.token_hash, /^[a-f0-9]{64}$/);
  assert.equal(proposal.used_at, null);

  const token = "known-reset-token";
  insertRecoveryToken(db, {
    token,
    guestId: "reset-guest-1",
    groupId,
    action: "reset_secret",
    targetEmail: "reset-person@example.local",
    createdByUserId: adminUserId
  });

  const resetPage = await client.get(`/guest-recovery/${token}`);
  assert.equal(resetPage.statusCode, 200);
  assert.match(resetPage.body, /Reset Guest/);
  assert.doesNotMatch(resetPage.body, /1111/);
  assert.doesNotMatch(resetPage.body, new RegExp(originalHash.slice(0, 16)));
  const resetCsrf = extractCsrfToken(resetPage.body);

  const reset = await client.post(`/guest-recovery/${token}`, {
    form: {
      _csrf: resetCsrf,
      claimSecretMode: "pin",
      claimPin: "2222"
    }
  });
  assert.equal(reset.statusCode, 200);
  assert.match(reset.body, /Guest recovery updated/);
  const updatedProfile = db
    .prepare("SELECT claim_secret_hash, claim_secret_mode FROM named_guest_profiles WHERE guest_id = ?")
    .get("reset-guest-1");
  assert.equal(updatedProfile.claim_secret_mode, "pin");
  assert.equal(updatedProfile.claim_secret_hash, hashClaimPin("2222"));
  assert.notEqual(updatedProfile.claim_secret_hash, originalHash);
  assert.ok(
    db.prepare("SELECT used_at FROM named_guest_recovery_tokens WHERE token_hash = ?").get(hashToken(token)).used_at
  );

  const reused = await client.get(`/guest-recovery/${token}`);
  assert.equal(reused.statusCode, 400);

  const expiredToken = "expired-reset-token";
  insertRecoveryToken(db, {
    token: expiredToken,
    guestId: "reset-guest-1",
    groupId,
    action: "reset_secret",
    targetEmail: "reset-person@example.local",
    createdByUserId: adminUserId,
    expiresAt: new Date(Date.now() - 60 * 1000).toISOString()
  });
  const expired = await client.get(`/guest-recovery/${expiredToken}`);
  assert.equal(expired.statusCode, 400);
  assert.equal(
    db.prepare("SELECT claim_secret_hash FROM named_guest_profiles WHERE guest_id = ?").get("reset-guest-1").claim_secret_hash,
    hashClaimPin("2222")
  );
  db.close();
});

test("owner recovery transfer requires POST confirmation and rejects token reuse", async (t) => {
  const { client, dbPath } = await startTestServer(t);

  await client.get("/");

  const db = new Database(dbPath);
  const { groupId } = seedInvitedGroup(db, {
    groupId: 880010,
    code: "SECJOIN10"
  });
  const adminUserId = addDevAdminToGroup(db, groupId);
  seedNamedGuest(db, {
    guestId: "transfer-guest-1",
    displayName: "Transfer Guest",
    groupId,
    pin: "3333"
  });
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO guest_responses (guest_id, group_id, question_id, answer, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run("transfer-guest-1", groupId, "drivers_championship_top_3", "guest-transfer-answer", now, now);
  const targetUserId = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, created_at, is_verified, verified_at, is_admin, is_simulated) VALUES (?, ?, ?, ?, 1, ?, 0, 0)"
    )
    .run("Transfer Target", "transfer-target@example.local", bcrypt.hashSync("secret-pass", 12), now, now)
    .lastInsertRowid;

  const groupPage = await client.get(`/groups/${groupId}`);
  assert.equal(groupPage.statusCode, 200);
  const groupCsrf = extractCsrfToken(groupPage.body);
  const proposed = await client.post(`/groups/${groupId}/named-guests/transfer-guest-1/transfer`, {
    form: {
      _csrf: groupCsrf,
      targetEmail: "transfer-target@example.local"
    }
  });
  assert.equal(proposed.statusCode, 302);
  const proposal = db
    .prepare("SELECT * FROM named_guest_recovery_tokens WHERE action = 'transfer' ORDER BY id DESC LIMIT 1")
    .get();
  assert.equal(proposal.guest_id, "transfer-guest-1");
  assert.equal(proposal.target_email, "transfer-target@example.local");
  assert.equal(proposal.target_user_id, targetUserId);
  assert.equal(proposal.created_by_user_id, adminUserId);
  assert.match(proposal.token_hash, /^[a-f0-9]{64}$/);
  assert.equal(proposal.used_at, null);

  const token = "known-transfer-token";
  insertRecoveryToken(db, {
    token,
    guestId: "transfer-guest-1",
    groupId,
    action: "transfer",
    targetEmail: "transfer-target@example.local",
    targetUserId,
    createdByUserId: adminUserId
  });

  const confirmation = await client.get(`/guest-recovery/${token}`);
  assert.equal(confirmation.statusCode, 200);
  assert.match(confirmation.body, /Transfer Guest/);
  assert.ok(
    db.prepare("SELECT 1 FROM named_guest_group_members WHERE guest_id = ?").get("transfer-guest-1")
  );
  assert.equal(
    db
      .prepare("SELECT 1 FROM responses WHERE user_id = ? AND group_id = ? AND question_id = ?")
      .get(targetUserId, groupId, "drivers_championship_top_3"),
    undefined
  );
  const confirmationCsrf = extractCsrfToken(confirmation.body);

  const confirmed = await client.post(`/guest-recovery/${token}`, {
    form: {
      _csrf: confirmationCsrf,
      [`group_${groupId}`]: "guest"
    }
  });
  assert.equal(confirmed.statusCode, 200);
  assert.match(confirmed.body, /Named Guest transferred/);
  assert.equal(
    db
      .prepare("SELECT answer FROM responses WHERE user_id = ? AND group_id = ? AND question_id = ?")
      .get(targetUserId, groupId, "drivers_championship_top_3").answer,
    "guest-transfer-answer"
  );
  assert.ok(
    db.prepare("SELECT 1 FROM group_members WHERE user_id = ? AND group_id = ?").get(targetUserId, groupId)
  );
  assert.equal(
    db.prepare("SELECT 1 FROM named_guest_group_members WHERE guest_id = ?").get("transfer-guest-1"),
    undefined
  );
  assert.equal(
    db.prepare("SELECT 1 FROM named_guest_profiles WHERE guest_id = ?").get("transfer-guest-1"),
    undefined
  );
  assert.ok(
    db.prepare("SELECT used_at FROM named_guest_recovery_tokens WHERE token_hash = ?").get(hashToken(token)).used_at
  );

  const reused = await client.get(`/guest-recovery/${token}`);
  assert.equal(reused.statusCode, 400);
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
