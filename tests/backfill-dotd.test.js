"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseDriverOfTheDayByRound } = require("../scripts/backfill-actuals-2026");

test("Driver of the Day parser consumes repeated race labels in calendar order", () => {
  const html = `
    <h2>Salesforce Driver of the Day RESULTS</h2>
    <div>Flag of Spain Barcelona-Catalunya Lewis Hamilton</div>
    <div>Flag of Spain Spain Max Verstappen</div>
  `;
  const result = parseDriverOfTheDayByRound(
    html,
    [
      { round: 7, raceName: "Barcelona-Catalunya Grand Prix" },
      { round: 14, raceName: "Spanish Grand Prix" }
    ],
    ["Lewis Hamilton", "Max Verstappen"]
  );

  assert.equal(result.get(7), "Lewis Hamilton");
  assert.equal(result.get(14), "Max Verstappen");
});
