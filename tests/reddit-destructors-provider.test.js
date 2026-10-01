"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  fetchFeed,
  mapDamageRows,
  parseDamageLines,
  parseFeed,
  selectCandidates
} = require("../src/reddit-destructors-provider");
const {
  ensureRaceDataSchema,
  findDestructorsSourcePost,
  saveDestructorsSourcePost
} = require("../src/race-data-evidence");
const { buildPersistedDataFromEvidence } = require("../src/race-evidence-derivation");

const feedXml = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>t3_test123</id>
    <link href="https://www.reddit.com/r/formula1/comments/test123/2026_destructors_championship_after_monaco_gp/" />
    <title>2026 Destructors Championship - after Monaco GP</title>
    <author><name>Dense-Strategy-867</name></author>
    <published>2026-05-25T10:00:00Z</published>
    <content type="html">&lt;p&gt;Damages:&lt;/p&gt;&lt;p&gt;- RUS: Front Wing, Rear Suspension&lt;/p&gt;&lt;p&gt;- XYZ: Side Pod&lt;/p&gt;</content>
  </entry>
</feed>`;

test("RSS parser selects the configured author and resolves the race title", () => {
  const entries = parseFeed(feedXml);
  assert.equal(entries.length, 1);
  const candidates = selectCandidates(entries, {
    author: "Dense-Strategy-867",
    season: 2026,
    races: [{ round_number: 6, display_name: "Monaco Grand Prix" }]
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].match.round, 6);
  assert.match(candidates[0].bodyText, /RUS: Front Wing/);
  assert.equal(parseDamageLines(candidates[0].bodyText).rows.length, 2);
});

test("damage parser preserves unknown drivers and marks missing costs unresolved", () => {
  const parsed = parseDamageLines("Damages:\n- RUS: Front Wing, Rear Wing\n- XYZ: Side Pod");
  assert.equal(parsed.rows.length, 2);
  assert.ok(parsed.warnings.includes("cost_missing:RUS"));
  const mapped = mapDamageRows({
    post: { title: "2026 Destructors Championship - after Monaco GP", bodyText: "Damages:\n- RUS: Front Wing, Rear Wing\n- XYZ: Side Pod" },
    season: 2026,
    races: [{ round_number: 6, display_name: "Monaco Grand Prix" }],
    drivers: [{ id: 1, driver_code: "RUS", display_name: "George Russell", team: { id: 10, display_name: "Mercedes" } }]
  });
  assert.equal(mapped.round, 6);
  assert.equal(mapped.rows[0].driverName, "George Russell");
  assert.equal(mapped.rows[1].driverName, "XYZ");
  assert.equal(mapped.complete, false);
});

test("RSS fetch retries a rate limit and returns parsed entries", async () => {
  let calls = 0;
  const response = (status, body = "") => ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => name.toLowerCase() === "retry-after" ? "0" : null },
    text: async () => body
  });
  const result = await fetchFeed({
    feedUrl: "https://example.test/feed",
    retries: 1,
    fetchImpl: async () => (++calls === 1 ? response(429) : response(200, feedXml)),
    sleep: async () => {}
  });
  assert.equal(calls, 2);
  assert.equal(result.status, "ok");
  assert.equal(result.entries.length, 1);
});

test("RSS fetch fails fast for a non-retryable response", async () => {
  let calls = 0;
  await assert.rejects(
    fetchFeed({
      feedUrl: "https://example.test/feed",
      retries: 3,
      fetchImpl: async () => {
        calls += 1;
        return { ok: false, status: 404, headers: { get: () => null } };
      },
      sleep: async () => {}
    }),
    (error) => error.statusCode === 404
  );
  assert.equal(calls, 1);
});

test("source post ledger is idempotent and persisted damage is reusable", (t) => {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.dialect = "sqlite";
  db.exec("CREATE TABLE actual_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, source_data_import_id INTEGER, source_data_snapshot_id INTEGER);");
  ensureRaceDataSchema(db);
  t.after(() => db.close());
  const first = saveDestructorsSourcePost(db, {
    postId: "t3_test123", season: 2026, contentHash: "hash-1", title: "Test", status: "pending_review",
    normalized: { rows: [{ driverCode: "RUS" }] }
  });
  const second = saveDestructorsSourcePost(db, {
    postId: "t3_test123", season: 2026, contentHash: "hash-2", title: "Updated", status: "ready_for_review"
  });
  assert.equal(first, second);
  assert.equal(findDestructorsSourcePost(db, "reddit_destructors", "t3_test123").content_hash, "hash-2");
  const data = buildPersistedDataFromEvidence([{
    round_number: 6,
    payload: {
      roundName: "Monaco Grand Prix",
      race: { rows: [] },
      standings: { drivers: [], constructors: [] },
      external: { damage: { available: true, rows: [{ round: 6, driver: "George Russell", constructor: "Mercedes", totalCost: 125000 }] } }
    }
  }], 2026);
  assert.equal(data.destructorsByRound.get(6)[0].driverName, "George Russell");
  assert.equal(data.destructorsByRound.get(6)[0].totalCost, 125000);
});
