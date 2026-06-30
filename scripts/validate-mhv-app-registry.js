"use strict";

const fs = require("fs");
const path = require("path");

const REQUIRED_APP_FIELDS = [
  "slug",
  "displayName",
  "repository",
  "paths",
  "hostnames",
  "docker",
  "health",
  "database",
  "state",
  "backup",
  "codex",
  "preview",
  "compatibilityNotes"
];

function isPresent(value) {
  return value !== undefined && value !== null && value !== "";
}

function requirePath(errors, object, objectPath) {
  if (!isPresent(object)) {
    errors.push(`${objectPath} is required`);
  }
}

function validateRegistry(registry) {
  const errors = [];

  if (!registry || typeof registry !== "object") {
    return ["registry must be an object"];
  }

  requirePath(errors, registry.schemaVersion, "schemaVersion");
  requirePath(errors, registry.updatedAt, "updatedAt");
  requirePath(errors, registry.platform, "platform");

  if (!Array.isArray(registry.apps)) {
    errors.push("apps must be an array");
    return errors;
  }

  const slugs = new Set();

  registry.apps.forEach((app, index) => {
    const appPath = `apps[${index}]`;
    if (!app || typeof app !== "object") {
      errors.push(`${appPath} must be an object`);
      return;
    }

    for (const field of REQUIRED_APP_FIELDS) {
      requirePath(errors, app[field], `${appPath}.${field}`);
    }

    if (isPresent(app.slug)) {
      if (slugs.has(app.slug)) {
        errors.push(`Duplicate app slug: ${app.slug}`);
      }
      slugs.add(app.slug);
    }

    requirePath(errors, app.paths?.currentProduction, `${appPath}.paths.currentProduction`);
    requirePath(errors, app.paths?.targetProduction, `${appPath}.paths.targetProduction`);
    requirePath(errors, app.paths?.targetShared, `${appPath}.paths.targetShared`);
    requirePath(errors, app.hostnames?.canonical, `${appPath}.hostnames.canonical`);
    requirePath(errors, app.docker?.appContainer, `${appPath}.docker.appContainer`);
    requirePath(errors, app.docker?.edgeUpstream, `${appPath}.docker.edgeUpstream`);
    requirePath(errors, app.health?.url, `${appPath}.health.url`);
    requirePath(errors, app.preview?.hostnamePattern, `${appPath}.preview.hostnamePattern`);

    if (app.database?.usesPostgres) {
      requirePath(errors, app.database.host, `${appPath}.database.host`);
      requirePath(errors, app.database.network, `${appPath}.database.network`);
      requirePath(errors, app.database.databaseKey, `${appPath}.database.databaseKey`);
      requirePath(errors, app.database.roleKey, `${appPath}.database.roleKey`);
    }
  });

  return errors;
}

function loadRegistry(registryPath) {
  return JSON.parse(fs.readFileSync(registryPath, "utf8"));
}

function main() {
  const registryPath = process.argv[2] || path.resolve(__dirname, "..", "ops", "mhv-app-registry.json");
  const registry = loadRegistry(registryPath);
  const errors = validateRegistry(registry);

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }
    process.exit(1);
  }

  console.log(`Validated MHV app registry: ${registry.apps.length} apps`);
}

if (require.main === module) {
  main();
}

module.exports = {
  validateRegistry
};
