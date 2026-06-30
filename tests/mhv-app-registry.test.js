"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validateLiveSnapshot, validateRegistry } = require("../scripts/validate-mhv-app-registry");

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

test("registry validation rejects reused PostgreSQL database roles", () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const invalid = clone(registry);
  invalid.apps[1].database.roleKey = invalid.apps[0].database.roleKey;

  assert.match(validateRegistry(invalid).join("\n"), /PostgreSQL roleKey reused: f1_predictions/);
});

test("registry validation requires backup classification for durable file state", () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const invalid = clone(registry);
  invalid.apps[0].backup.fileStateBackups = false;

  assert.match(
    validateRegistry(invalid).join("\n"),
    /apps\[0\]\.backup\.fileStateBackups must cover or explicitly require validation for durable file state/
  );
});

test("live snapshot validation accepts registered routes, containers, networks, and fail-closed wildcard", () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const snapshot = {
    caddyfile: `
      {$F1_DOMAIN:wheelofknowledge.com}, www.{$F1_DOMAIN:wheelofknowledge.com}, wok.mhvmade.com {
        reverse_proxy f1-app:3000
      }
      kinara.mhvmade.com { reverse_proxy kinara-app:3000 }
      apps.mhvmade.com { reverse_proxy mhvmade-apps:3000 }
      {$PORTFOLIO_DOMAIN:mhvmade.com}, www.{$PORTFOLIO_DOMAIN:mhvmade.com} {
        reverse_proxy mhvmade-portfolio:80
      }
    `,
    containers: {
      "f1predictions-app-1": { networks: ["f1predictions_default", "mhv-db", "mhv-web"] },
      "kinara-app": { networks: ["kinara-internal", "mhv-db", "mhv-web"] },
      "mhvmade-apps": { networks: ["mhv-web"] },
      "mhvmade-portfolio": { networks: ["mhv-web"] }
    },
    health: {
      "https://wheelofknowledge.com/healthz": {
        status: 200,
        json: { databaseBackend: "postgres" }
      },
      "https://kinara.mhvmade.com": { status: 200 },
      "https://apps.mhvmade.com": { status: 302 },
      "https://mhvmade.com": { status: 200 }
    },
    unknownWildcard: { status: 525 }
  };

  assert.deepEqual(validateLiveSnapshot(registry, snapshot), []);
});

test("live snapshot validation reports missing Caddy routes and network drift", () => {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const snapshot = {
    caddyfile: "wheelofknowledge.com { reverse_proxy f1-app:3000 }",
    containers: {
      "f1predictions-app-1": { networks: ["mhv-web"] }
    },
    health: {
      "https://wheelofknowledge.com/healthz": {
        status: 503,
        json: { databaseBackend: "sqlite" }
      }
    },
    unknownWildcard: { status: 200 }
  };

  const errors = validateLiveSnapshot(registry, snapshot).join("\n");
  assert.match(errors, /Caddy route missing for wok\.mhvmade\.com/);
  assert.match(errors, /Container f1predictions-app-1 missing network mhv-db/);
  assert.match(errors, /Health check https:\/\/wheelofknowledge\.com\/healthz returned 503/);
  assert.match(errors, /Unknown wildcard hostname did not fail closed/);
});
