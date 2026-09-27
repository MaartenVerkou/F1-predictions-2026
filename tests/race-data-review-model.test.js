"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  actualOverviewViewForQuestion,
  buildRaceDataMetricOptions,
  formatActualOverviewValue
} = require("../src/race-data-review-model");

test("race-data metric registry exposes one shared set of review metrics", () => {
  const options = buildRaceDataMetricOptions((key) => ({
    "admin_race_data.points": "Points",
    "admin_race_data.focus_dnfs": "DNFs"
  }[key] || key));
  assert.deepEqual(options.map((option) => option.id), [
    "points",
    "metric:podiums",
    "metric:dnfs",
    "metric:grid_wins",
    "metric:driver_of_day",
    "metric:sprint_points",
    "metric:damage"
  ]);
  assert.equal(options.find((option) => option.id === "metric:dnfs").label, "DNFs");
  assert.equal(options.every((option) => option.view === "all"), true);
});

test("actual overview formats snapshot values without exposing JSON noise", () => {
  assert.equal(formatActualOverviewValue(JSON.stringify(["George Russell", "Kimi Antonelli"])), "George Russell, Kimi Antonelli");
  assert.equal(formatActualOverviewValue(JSON.stringify({ winner: "Norris", diff: 12 })), "Norris · 12 pts");
  assert.equal(formatActualOverviewValue(JSON.stringify({ value: "1", driver: "George Russell" })), "1 · George Russell");
  assert.equal(formatActualOverviewValue(JSON.stringify({ dnf_by_race: { R1: 2, R2: 1 } })), "3 DNFs");
  assert.equal(formatActualOverviewValue("yes"), "yes");
  assert.equal(formatActualOverviewValue(null), "—");
});

test("question review links use the configured canonical table", () => {
  assert.equal(actualOverviewViewForQuestion({ race_data_focus: { view: "constructors" } }), "constructors");
  assert.equal(actualOverviewViewForQuestion({ race_data_focus: { view: "drivers" } }), "drivers");
  assert.equal(actualOverviewViewForQuestion({}), "drivers");
});
