"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");

test("the production compose configuration reads bundled F1 data files", () => {
  const compose = fs.readFileSync(path.join(ROOT, "docker-compose.yml"), "utf8");

  const bundledPaths = {
    QUESTIONS_PATH: "questions.json",
    ROSTER_PATH: "roster.json",
    RACES_PATH: "races.json",
    LAST_SEASON_RESULTS_PATH: "last-season-results.json"
  };

  for (const [setting, file] of Object.entries(bundledPaths)) {
    assert.match(
      compose,
      new RegExp(`- ${setting}=/app/data/${file.replace(".", "\\.")}`)
    );
    assert.equal(fs.existsSync(path.join(ROOT, "data", file)), true);
  }

  assert.doesNotMatch(compose, /\/app\/config\//);
});
