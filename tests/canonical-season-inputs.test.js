const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCanonicalCatalog,
  canonicalizeQuestionValue
} = require("../src/canonical-answers");
const leaderboard = require("../src/leaderboard-model");
const { TEAM_DISPLAY_ORDER, TEAM_DRIVER_ORDER } = require("../scripts/seed-season-inputs");
const { normalizeDriverNumber, sortSeasonDrivers } = require("../src/season-inputs");

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
