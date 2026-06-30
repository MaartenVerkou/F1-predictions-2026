"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validateRegistry } = require("../scripts/validate-mhv-app-registry");

const ROOT = path.resolve(__dirname, "..");
const registryPath = path.join(ROOT, "ops", "mhv-app-registry.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("current MHV app registry is structurally valid", () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

  assert.deepEqual(validateRegistry(registry), []);
});

test("registry validation rejects duplicate app slugs", () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const invalid = clone(registry);
  invalid.apps[1].slug = invalid.apps[0].slug;

  assert.match(validateRegistry(invalid).join("\n"), /Duplicate app slug: wok/);
});

test("registry validation requires operational metadata", () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const invalid = clone(registry);
  delete invalid.apps[0].health.url;
  invalid.apps[0].hostnames.canonical = "";

  const errors = validateRegistry(invalid).join("\n");
  assert.match(errors, /apps\[0\]\.health\.url is required/);
  assert.match(errors, /apps\[0\]\.hostnames\.canonical is required/);
});
