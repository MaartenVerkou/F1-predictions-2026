"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveConfiguredRaceName } = require("../src/race-names");

test("resolves API Barcelona race name to configured race name", () => {
  const races = [
    "Monaco Grand Prix",
    "Barcelona-Catalunya Grand Prix",
    "Spanish Grand Prix"
  ];

  assert.equal(
    resolveConfiguredRaceName("Barcelona Grand Prix", races),
    "Barcelona-Catalunya Grand Prix"
  );
});

test("does not alias to a race that is not configured", () => {
  assert.equal(resolveConfiguredRaceName("Barcelona Grand Prix", ["Spanish Grand Prix"]), null);
});
