const test = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");

const {
  buildCanonicalCatalog,
  canonicalizeQuestionValue
} = require("../src/canonical-answers");
const leaderboard = require("../src/leaderboard-model");
const { TEAM_DISPLAY_ORDER, TEAM_DRIVER_ORDER } = require("../scripts/seed-season-inputs");
const {
  addEntityAlias,
  addProviderReference,
  assignmentForRound,
  ensureSeasonInputsSchema,
  resolveEntity,
  normalizeDriverNumber,
  sortSeasonDrivers
} = require("../src/season-inputs");

const catalog = buildCanonicalCatalog({
  drivers: [{ id: 1, display_name: "Lewis Hamilton", slug: "lewis-hamilton" }],
  teams: [{ id: 2, display_name: "Ferrari", slug: "ferrari" }],
  races: [{ id: 3, display_name: "Australian Grand Prix", slug: "australia" }]
});

test("canonical answer conversion resolves legacy labels and keeps references stable", () => {
  const question = { type: "ranking", options_source: "drivers" };
  assert.deepEqual(
    canonicalizeQuestionValue(question, ["Lewis Hamilton", "driver:1"], catalog),
    ["driver:1", "driver:1"]
  );
});

test("composite race answers canonicalize nested drivers and race keys", () => {
  const driverQuestion = { type: "boolean_with_optional_driver" };
  assert.deepEqual(
    canonicalizeQuestionValue(driverQuestion, { choice: "yes", driver: "Lewis Hamilton" }, catalog),
    { choice: "yes", driver: "driver:1" }
  );

  const dnfQuestion = { type: "multi_select_limited", options_source: "races" };
  assert.deepEqual(
    canonicalizeQuestionValue(dnfQuestion, { dnf_by_race: { "Australian Grand Prix": 2 } }, catalog),
    { dnf_by_race: { "race:3": 2 } }
  );
});

test("leaderboard scoring dual-reads legacy labels and canonical references", () => {
  const question = {
    type: "single_choice",
    options_source: "drivers",
    points: 4,
    _canonicalCatalog: catalog
  };
  assert.equal(
    leaderboard.scoreLeaderboardQuestion(
      question,
      leaderboard.parseLeaderboardStoredValue(question, "driver:1"),
      leaderboard.parseLeaderboardStoredValue(question, "Lewis Hamilton")
    ),
    4
  );
});

test("season lineup keeps presentation order independent from database ids", () => {
  assert.deepEqual(TEAM_DISPLAY_ORDER.slice(0, 4), ["Mercedes", "Ferrari", "McLaren", "Red Bull Racing"]);
  assert.equal(TEAM_DISPLAY_ORDER.length, 11);
  assert.deepEqual(TEAM_DRIVER_ORDER.Williams, ["Carlos Sainz Jr.", "Alexander Albon"]);
});

test("each seeded team has two explicit driver seats", () => {
  for (const team of TEAM_DISPLAY_ORDER) {
    assert.equal((TEAM_DRIVER_ORDER[team] || []).length, 2, `${team} must have two seats`);
    assert.notEqual(TEAM_DRIVER_ORDER[team][0], TEAM_DRIVER_ORDER[team][1]);
  }
});

test("driver numbers normalize and determine presentation order", () => {
  assert.equal(normalizeDriverNumber("03"), "3");
  assert.equal(normalizeDriverNumber(""), null);
  assert.throws(() => normalizeDriverNumber("100"), /between 1 and 99/);
  assert.deepEqual(
    sortSeasonDrivers([
      { id: 2, driver_number: null },
      { id: 8, driver_number: "44" },
      { id: 3, driver_number: "3" },
      { id: 1, driver_number: "44" }
    ]).map((driver) => driver.id),
    [3, 1, 8, 2]
  );
});

function createCanonicalDb() {
  const db = new Database(":memory:");
  db.dialect = "sqlite";
  ensureSeasonInputsSchema(db);
  db.exec(`
    INSERT INTO seasons (id, year, label, status, created_at, updated_at) VALUES
      (1, 2026, '2026', 'active', 'now', 'now'),
      (2, 2027, '2027', 'planned', 'now', 'now');
    INSERT INTO drivers (id, slug, given_name, family_name, display_name, created_at, updated_at) VALUES
      (1, 'alex-driver', 'Alex', 'Driver', 'Alex Driver', 'now', 'now'),
      (2, 'replacement-driver', 'Replacement', 'Driver', 'Replacement Driver', 'now', 'now'),
      (3, 'other-season-driver', 'Other', 'Driver', 'Other Driver', 'now', 'now');
    INSERT INTO teams (id, slug, display_name, created_at, updated_at) VALUES
      (10, 'test-team', 'Test Team', 'now', 'now');
    INSERT INTO races (id, season_id, round_number, slug, display_name, calendar_state, created_at, updated_at) VALUES
      (101, 1, 1, 'round-1', 'Round 1', 'completed', 'now', 'now'),
      (102, 1, 8, 'round-8', 'Round 8', 'scheduled', 'now', 'now'),
      (201, 2, 1, 'round-1', 'Round 1', 'scheduled', 'now', 'now');
    INSERT INTO season_drivers (season_id, driver_id, created_at, updated_at) VALUES
      (1, 1, 'now', 'now'), (1, 2, 'now', 'now'), (2, 3, 'now', 'now');
    INSERT INTO season_teams (season_id, team_id, created_at, updated_at) VALUES
      (1, 10, 'now', 'now');
    INSERT INTO driver_team_assignments (id, season_id, driver_id, team_id, from_round, to_round, seat_number, source, created_at, updated_at) VALUES
      (1001, 1, 1, 10, 1, 7, 1, 'seed', 'now', 'now'),
      (1002, 1, 2, 10, 8, NULL, 1, 'seed', 'now', 'now');
  `);
  return db;
}

test("provider mappings resolve the stable canonical entity and reject type conflicts", (t) => {
  const db = createCanonicalDb();
  t.after(() => db.close());

  addProviderReference(db, {
    entityType: "driver",
    entityId: 1,
    provider: "ergast",
    providerKey: "alex-1",
    providerLabel: "Alex Driver"
  });

  const resolved = resolveEntity(db, {
    entityType: "driver",
    seasonId: 1,
    provider: "ergast",
    providerKey: "alex-1"
  });
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.entity.entityId, 1);

  const conflict = resolveEntity(db, {
    entityType: "team",
    seasonId: 1,
    provider: "ergast",
    providerKey: "alex-1"
  });
  assert.equal(conflict.status, "conflict");
  assert.equal(conflict.entity.entityId, 1);
});

test("season-scoped aliases remain unresolved when two canonical identities match", (t) => {
  const db = createCanonicalDb();
  t.after(() => db.close());

  addEntityAlias(db, { entityType: "driver", entityId: 1, seasonId: null, alias: "The Driver", source: "provider" });
  addEntityAlias(db, { entityType: "driver", entityId: 2, seasonId: 1, alias: "The Driver", source: "provider" });

  const result = resolveEntity(db, { entityType: "driver", seasonId: 1, label: "The Driver" });
  assert.equal(result.status, "ambiguous");
  assert.deepEqual(result.candidates.map((candidate) => candidate.entityId).sort(), [1, 2]);
});

test("canonical references survive display renames while unknown legacy values remain unchanged", () => {
  const renamedCatalog = buildCanonicalCatalog({
    drivers: [{ id: 1, display_name: "Alexandra Driver", slug: "alex-driver" }],
    teams: [],
    races: []
  });
  const question = { type: "single_choice", options_source: "drivers" };

  assert.equal(canonicalizeQuestionValue(question, "Alexandra Driver", renamedCatalog), "driver:1");
  assert.equal(canonicalizeQuestionValue(question, "driver:1", renamedCatalog), "driver:1");
  assert.equal(canonicalizeQuestionValue(question, "Former Provider Label", renamedCatalog), "Former Provider Label");
});

test("assignment lookup respects both season and selected round cutoff", (t) => {
  const db = createCanonicalDb();
  t.after(() => db.close());

  assert.equal(assignmentForRound(db, { seasonId: 1, driverId: 1, roundNumber: 7 }).team_id, 10);
  assert.equal(assignmentForRound(db, { seasonId: 1, driverId: 1, roundNumber: 8 }), null);
  assert.equal(assignmentForRound(db, { seasonId: 1, driverId: 2, roundNumber: 8 }).from_round, 8);
  assert.equal(assignmentForRound(db, { seasonId: 2, driverId: 1, roundNumber: 8 }), null);
});
