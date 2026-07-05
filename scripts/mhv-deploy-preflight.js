"use strict";

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

function loadRegistry(registryPath) {
  return JSON.parse(fs.readFileSync(registryPath, "utf8"));
}

function request(url) {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.request(url, { method: "GET", timeout: 10000 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        let json;
        try {
          json = body ? JSON.parse(body) : undefined;
        } catch (_error) {
          json = undefined;
        }
        resolve({ status: res.statusCode, json });
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error(`Timed out requesting ${url}`));
    });
    req.on("error", (error) => {
      resolve({ status: 0, error: error.message });
    });
    req.end();
  });
}

function validateDeployPreflight(registry, slug, snapshot = {}) {
  const errors = [];
  const app = (registry.apps || []).find((candidate) => candidate.slug === slug);

  if (!app) {
    return [`App is not registered: ${slug}`];
  }

  if (!app.paths?.currentProduction) {
    errors.push(`Registered app ${slug} has no current production path`);
  }

  if (!app.docker?.appService && !app.docker?.appContainer) {
    errors.push(`Registered app ${slug} has no Docker service or container metadata`);
  }

  if (!app.health?.url) {
    errors.push(`Registered app ${slug} has no health URL`);
  }

  const healthResult = snapshot.health?.[app.health?.url];
  if (healthResult) {
    if (healthResult.status !== app.health.expectedStatus) {
      errors.push(`${app.health.url} returned ${healthResult.status}, expected ${app.health.expectedStatus}`);
    }

    if (app.health.expectedDatabaseBackend && healthResult.json?.databaseBackend !== app.health.expectedDatabaseBackend) {
      errors.push(
        `${app.health.url} databaseBackend was ${healthResult.json?.databaseBackend}, expected ${app.health.expectedDatabaseBackend}`
      );
    }
  }

  return errors;
}

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find((arg) => !arg.startsWith("--"));
  const live = args.includes("--live");

  if (!slug) {
    console.error("Usage: node scripts/mhv-deploy-preflight.js <app-slug> [--live]");
    process.exit(1);
  }

  const registryPath = path.resolve(__dirname, "..", "ops", "mhv-app-registry.json");
  const registry = loadRegistry(registryPath);
  const app = (registry.apps || []).find((candidate) => candidate.slug === slug);
  const snapshot = { health: {} };

  if (live && app?.health?.url) {
    snapshot.health[app.health.url] = await request(app.health.url);
  }

  const errors = validateDeployPreflight(registry, slug, snapshot);
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }
    process.exit(1);
  }

  console.log(`Deploy preflight passed for ${slug}${live ? " with live health check" : ""}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  validateDeployPreflight
};
