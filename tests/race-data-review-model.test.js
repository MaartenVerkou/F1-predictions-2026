"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  RACE_RESULT_COLUMNS,
  actualOverviewViewForQuestion,
  buildRaceResultColumns,
  buildRaceDataMetricOptions,
  formatActualOverviewValue,
  formatRaceFinishLabel,
  getRaceSessionRows
} = require("../src/race-data-review-model");

test("race-result registry keeps facts in a stable review order", () => {
  assert.deepEqual(RACE_RESULT_COLUMNS.map((column) => column.id), [
    "finish",
    "driver",
    "constructor",
    "qualifying",
    "grid",
    "status",
    "points"
  ]);
  assert.equal(formatRaceFinishLabel(1), "1");
  assert.equal(formatRaceFinishLabel(2), "2");
  assert.equal(formatRaceFinishLabel(3), "3");
  assert.equal(formatRaceFinishLabel(14), "14");
  assert.equal(formatRaceFinishLabel(0), "—");
});

test("race result columns follow available normal and sprint sessions", () => {
  const normal = buildRaceResultColumns({
    payload: {
      practice: {
        practice1: { rows: [{ driver: "Alpha", position: 3 }] },
        practice2: { rows: [{ driver: "Alpha", position: 2 }] },
        practice3: { rows: [{ driver: "Alpha", position: 1 }] }
      },
      qualifying: { rows: [{ driver: "Alpha", position: 1 }] },
      race: { rows: [{ driver: "Alpha", position: 1 }] }
    }
  });
  assert.deepEqual(normal.map((column) => column.id), [
    "finish", "driver", "constructor", "practice1", "practice2", "practice3", "qualifying", "grid", "status", "points"
  ]);
  assert.equal(normal.find((column) => column.id === "practice1").title, "Practice 1");
  assert.equal(normal.find((column) => column.id === "qualifying").title, "Grand Prix qualifying");

  const sprint = buildRaceResultColumns({
    payload: {
      practice1: { rows: [{ driver: "Alpha", position: 3 }] },
      sprintQualifying: { rows: [{ driver: "Alpha", position: 2 }] },
      sprint: { rows: [{ driver: "Alpha", position: 1 }] },
      qualifying: { rows: [{ driver: "Alpha", position: 4 }] },
      race: { rows: [{ driver: "Alpha", position: 2 }] }
    }
  });
  assert.deepEqual(sprint.map((column) => column.id), [
    "finish", "driver", "constructor", "practice1", "sprintQualifying", "sprint", "qualifying", "grid", "status", "points"
  ]);
  assert.equal(sprint.find((column) => column.id === "sprintQualifying").label, "Sprint Q");
  assert.deepEqual(getRaceSessionRows({ practice: [{ session_type: "Practice 2", rows: [{ driver: "Alpha" }] }] }, "practice2"), [{ driver: "Alpha" }]);
});

test("race-data metric registry exposes one shared set of review metrics", () => {
  const options = buildRaceDataMetricOptions((key) => ({
    "admin_race_data.points": "Points",
    "admin_race_data.focus_dnfs": "DNFs"
  }[key] || key));
  assert.deepEqual(options.map((option) => option.id), [
    "points",
    "championship_points_results",
    "metric:podiums",
    "metric:dnfs",
    "metric:grid_wins",
    "metric:driver_of_day",
    "metric:sprint_points",
    "metric:damage"
  ]);
  assert.equal(options.find((option) => option.id === "metric:dnfs").label, "DNFs");
  assert.equal(options.find((option) => option.id === "points").label, "Results");
  assert.equal(options.find((option) => option.id === "points").title, "Cumulative championship results");
  assert.equal(options.find((option) => option.id === "championship_points_results").label, "Points");
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
