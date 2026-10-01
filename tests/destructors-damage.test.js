"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  aggregateDamageByEntity,
  formatDamageCost,
  formatDamageCostExact,
  topDamageEntities
} = require("../src/destructors-damage");

test("damage costs aggregate by driver and constructor through a cutoff", () => {
  const source = new Map([
    [1, [
      { round: 1, driverName: "A", constructorName: "Team A", components: [{ price: 1000, quantity: 2 }] },
      { round: 1, driverName: "B", constructorName: "Team B", totalCost: 500 }
    ]],
    [2, [{ round: 2, driverName: "A", constructorName: "Team A", totalCost: 3000 }]],
    [3, [{ round: 3, driverName: "A", constructorName: "Team A", totalCost: 9000 }]]
  ]);
  assert.equal(aggregateDamageByEntity(source, { maxRound: 2, entityType: "driver" }).get("A"), 5000);
  assert.deepEqual(topDamageEntities(source, { maxRound: 2, entityType: "team" }), ["Team A"]);
  assert.equal(formatDamageCost(2033000), "$2.03M");
  assert.equal(formatDamageCostExact(2033000), "$2,033,000");
});
