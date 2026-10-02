"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Database = require("better-sqlite3");
const { run } = require("../scripts/import-destructors-reddit");
const {
  ensureSeasonInputsSchema,
  createOrGetSeason,
  upsertDriver,
  upsertTeam,
  upsertRace,
  upsertSeasonDriver,
  upsertSeasonTeam,
  upsertDriverTeamAssignment
} = require("../src/season-inputs");

const feedXml = `<?xml version="1.0"?><feed><entry><id>t3_smoke</id><link href="https://reddit.test/t3_smoke"/><title>2026 Destructors Championship - after Monaco GP</title><author><name>Dense-Strategy-867</name></author><content>&lt;p&gt;Damages:&lt;/p&gt;&lt;p&gt;- RUS: Front Wing = $125k&lt;/p&gt;</content></entry></feed>`;

function seedDatabase(filePath) {
  const db = new Database(filePath);
  db.dialect = "sqlite";
  ensureSeasonInputsSchema(db);
  db.exec("CREATE TABLE actual_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, season INTEGER, round_number INTEGER, round_name TEXT, label TEXT, source_type TEXT, source_note TEXT, created_at TEXT, created_by_user_id INTEGER);");
  db.exec("CREATE TABLE actual_snapshot_values (snapshot_id INTEGER, question_id TEXT, value TEXT, PRIMARY KEY(snapshot_id, question_id));");
  const season = createOrGetSeason(db, { year: 2026, status: "active" });
  const driver = upsertDriver(db, { displayName: "George Russell", slug: "george-russell", driverCode: "RUS" });
  const team = upsertTeam(db, { displayName: "Mercedes", slug: "mercedes", teamCode: "MER" });
  upsertSeasonDriver(db, { seasonId: season.id, driverId: driver, driverNumber: "63" });
  upsertSeasonTeam(db, { seasonId: season.id, teamId: team });
  upsertDriverTeamAssignment(db, { seasonId: season.id, driverId: driver, teamId: team, fromRound: 1 });
  upsertRace(db, { seasonId: season.id, roundNumber: 6, slug: "monaco-grand-prix", displayName: "Monaco Grand Prix", scheduledDate: "2026-05-24T13:00:00Z", calendarState: "completed" });
  db.close();
}

test("Reddit import is idempotent and keeps evidence/actuals pending", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wok-destructors-test-"));
  const dbPath = path.join(directory, "app.db");
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  seedDatabase(dbPath);
  const args = { apply: true, dryRun: false, season: 2026, round: null, feedUrl: "https://reddit.test/feed", author: "Dense-Strategy-867", dbPath, databaseUrl: "" };
  const fetchImpl = async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => feedXml });
  const first = await run(args, { fetchImpl, sleep: async () => {} });
  const second = await run(args, { fetchImpl, sleep: async () => {} });
  const db = new Database(dbPath);
  const sourceCount = db.prepare("SELECT COUNT(*) AS count FROM destructors_source_posts").get().count;
  const evidenceCount = db.prepare("SELECT COUNT(*) AS count FROM race_data_snapshots").get().count;
  const pending = db.prepare("SELECT review_status FROM actual_snapshots ORDER BY id DESC LIMIT 1").get();
  db.close();
  assert.equal(first.imported, 1);
  assert.equal(first.pending, 1);
  assert.equal(second.skipped, 1);
  assert.equal(sourceCount, 1);
  assert.equal(evidenceCount, 1);
  assert.equal(pending.review_status, "pending");
});

test("blocked or rate-limited Reddit discovery never opens a database mutation", async () => {
  const result = await run({
    apply: true,
    dryRun: false,
    season: 2026,
    round: null,
    feedUrl: "https://reddit.test/feed",
    author: "Dense-Strategy-867",
    dbPath: "/path/that/is/not/opened",
    databaseUrl: ""
  }, {
    fetchImpl: async () => ({ ok: false, status: 403, headers: { get: () => null } }),
    sleep: async () => {}
  });
  assert.equal(result.status, "blocked");
});

test("Formula 1 Dashboard destructors import keeps the API mirror pending and idempotent", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "wok-dashboard-destructors-test-"));
  const dbPath = path.join(directory, "app.db");
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  seedDatabase(dbPath);
  const apiRows = [{
    round: 6,
    driver_number: 63,
    driver_season: {
      id: 168,
      constructor_id: 4,
      driver: { name: "Russell" },
      constructor: { name: "Mercedes" }
    },
    grand_prix_id: 8,
    grand_prix: { country: "Monaco" },
    components: [{ component_id: 1, name: "Front wing", price: 125000, quantity: 1 }]
  }];
  const responseFor = (url) => ({
    ok: true,
    status: 200,
    headers: { get: (name) => name === "content-type" ? "application/json" : null },
    json: async () => apiRows
  });
  const args = {
    apply: true,
    dryRun: false,
    source: "formula1_dashboard",
    season: 2026,
    round: null,
    dashboardBaseUrl: "https://api.example.test",
    dashboardProxyBaseUrl: "",
    feedUrl: "https://reddit.test/feed",
    author: "Dense-Strategy-867",
    dbPath,
    databaseUrl: ""
  };
  const first = await run(args, {
    fetchImpl: async () => responseFor("api"),
    sleep: async () => {}
  });
  const second = await run(args, {
    fetchImpl: async () => responseFor("api"),
    sleep: async () => {}
  });
  const db = new Database(dbPath);
  const source = db.prepare("SELECT provider, parser_version, status FROM destructors_source_posts").get();
  const evidence = db.prepare("SELECT payload_json FROM race_data_snapshots ORDER BY id DESC LIMIT 1").get();
  const pending = db.prepare("SELECT review_status FROM actual_snapshots ORDER BY id DESC LIMIT 1").get();
  db.close();
  assert.equal(first.imported, 1);
  assert.equal(first.pending, 1);
  assert.equal(second.skipped, 1);
  assert.deepEqual(source, {
    provider: "reddit_destructors",
    parser_version: "formula1dashboard-api-v2",
    status: "ready_for_review"
  });
  assert.equal(JSON.parse(evidence.payload_json).external.damage.rows[0].totalCost, 125000);
  assert.equal(pending.review_status, "pending");
});
