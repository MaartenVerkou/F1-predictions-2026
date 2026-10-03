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

test("WOK runtime names use canonical production and stable-preview identifiers", () => {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "ops", "mhv-app-registry.json"), "utf8"));
  const app = registry.apps.find((candidate) => candidate.slug === "wok");
  const compose = fs.readFileSync(path.join(ROOT, "docker-compose.yml"), "utf8");
  const serverCompose = fs.readFileSync(path.join(ROOT, "docker-compose.server.yml"), "utf8");
  const deploy = fs.readFileSync(path.join(ROOT, "scripts", "deploy-app.sh"), "utf8");

  assert.equal(app.docker.appContainer, "wheelofknowledge");
  assert.equal(app.docker.edgeUpstream, "wheelofknowledge:3000");
  assert.deepEqual(app.docker.webAliases, ["wheelofknowledge", "f1-app"]);
  assert.equal(app.preview.stableContainerName, "preview-wok");
  assert.match(compose, /container_name:\s*wheelofknowledge/);
  assert.match(serverCompose, /- wheelofknowledge/);
  assert.match(serverCompose, /- f1-app/);
  assert.match(deploy, /WOK_APP_CONTAINER/);
  assert.match(deploy, /wheelofknowledge/);
});
