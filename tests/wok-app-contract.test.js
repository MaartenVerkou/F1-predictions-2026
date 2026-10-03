"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

test("WOK app contract and registry share one canonical identity", () => {
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, "mhv-app.yaml"), "utf8"));
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "ops", "mhv-app-registry.json"), "utf8"));
  const app = registry.apps.find((candidate) => candidate.slug === "wok");

  assert.ok(app, "registry must contain the canonical WOK app");
  assert.equal(contract.app.slug, app.slug);
  assert.equal(contract.app.displayName, app.displayName);
  assert.deepEqual(contract.app.compatibilityAliases, app.compatibilityAliases);
  assert.equal(contract.preview.dataMode, "sanitized");
  assert.equal(contract.production.domain, app.hostnames.canonical);
  assert.equal(contract.production.databaseBackend, "postgres");
  assert.equal(contract.runtime.healthPath, "/healthz");
  assert.equal(contract.source.workspace, "/home/mhv-operator/workspace/f1");
});
