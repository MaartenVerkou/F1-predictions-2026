"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildActualsOverview } = require("../src/actuals-overview");

test("builds one season overview from the latest persisted snapshot per round", () => {
  const overview = buildActualsOverview({
    season: 2026,
    races: ["Australian Grand Prix", "Chinese Grand Prix", "Japanese Grand Prix"],
    questions: [
      { id: "points_question", prompt: "Who leads?", race_data_focus: { view: "drivers" } },
      { id: "team_question", prompt: "Which team?", race_data_focus: { view: "constructors" } }
    ],
    snapshots: [
      { id: 101, round_number: 1, review_status: "reviewed", updated_at: "2026-03-10T00:00:00Z" },
      { id: 102, round_number: 2, review_status: "pending", updated_at: "2026-03-20T00:00:00Z" }
    ],
    latestRoundNumber: 2,
    publishedActuals: { available: true, snapshot: { round_number: 1 } },
    fetchSnapshotValues: (snapshotId) => snapshotId === 101
      ? { points_question: '["Antonelli","Russell","Leclerc"]' }
      : { team_question: '"Mercedes"' }
  });

  assert.deepEqual(overview.targets.map((target) => target.timing), ["past", "current", "future"]);
  assert.deepEqual(overview.targets.map((target) => target.reviewStatus), ["reviewed", "pending", null]);
  assert.deepEqual(overview.targets.map((target) => target.published), [true, false, false]);
  assert.equal(overview.pendingCount, 1);
  assert.equal(overview.publishedRound, 1);
  assert.equal(overview.rows[0].cells[0].value, "Antonelli, Russell, Leclerc");
  assert.deepEqual(overview.rows[0].cells[0].lines, ["Antonelli", "Russell", "Leclerc"]);
  assert.match(overview.rows[0].cells[0].href, /round=1/);
  assert.match(overview.rows[0].cells[0].href, /view=drivers/);
  assert.match(overview.rows[1].cells[0].href, /view=constructors/);
  assert.equal(overview.rows[0].cells[2].hasValue, false);
});
