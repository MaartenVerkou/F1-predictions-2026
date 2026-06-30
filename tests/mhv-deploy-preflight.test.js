"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validateDeployPreflight } = require("../scripts/mhv-deploy-preflight");

const ROOT = path.resolve(__dirname, "..");
const registryPath = path.join(ROOT, "ops", "mhv-app-registry.json");

test("deploy preflight rejects unregistered app before deployment", () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

  assert.match(validateDeployPreflight(registry, "missing-app").join("\n"), /App is not registered: missing-app/);
});

test("deploy preflight accepts registered app without live health check", () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

  assert.deepEqual(validateDeployPreflight(registry, "wok"), []);
});

test("deploy preflight validates health from registry metadata", () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const health = {
    "https://wheelofknowledge.com/healthz": {
      status: 200,
      json: { databaseBackend: "postgres" }
    }
  };

  assert.deepEqual(validateDeployPreflight(registry, "wok", { health }), []);
});

test("deploy preflight reports health drift before deployment succeeds", () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const health = {
    "https://wheelofknowledge.com/healthz": {
      status: 200,
      json: { databaseBackend: "sqlite" }
    }
  };

  assert.match(
    validateDeployPreflight(registry, "wok", { health }).join("\n"),
    /databaseBackend was sqlite, expected postgres/
  );
});
