"use strict";

const fs = require("fs");
const { spawnSync } = require("child_process");
const http = require("http");
const https = require("https");
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
  const postgresDatabaseKeys = new Set();
  const postgresRoleKeys = new Set();

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

      if (isPresent(app.database.databaseKey)) {
        if (postgresDatabaseKeys.has(app.database.databaseKey)) {
          errors.push(`PostgreSQL databaseKey reused: ${app.database.databaseKey}`);
        }
        postgresDatabaseKeys.add(app.database.databaseKey);
      }

      if (isPresent(app.database.roleKey)) {
        if (postgresRoleKeys.has(app.database.roleKey)) {
          errors.push(`PostgreSQL roleKey reused: ${app.database.roleKey}`);
        }
        postgresRoleKeys.add(app.database.roleKey);
      }
    }

    if ((app.state?.durableFilePaths || []).length > 0) {
      const backupStatus = app.backup?.fileStateBackups;
      if (backupStatus !== true && backupStatus !== "needs-validation") {
        errors.push(`${appPath}.backup.fileStateBackups must cover or explicitly require validation for durable file state`);
      }
    }
  });

  return errors;
}

function getRegisteredHostnames(app) {
  return [
    app.hostnames?.canonical,
    ...(app.hostnames?.redirects || []),
    ...(app.hostnames?.aliases || [])
  ].filter(isPresent);
}

function normalizeCaddyfile(caddyfile) {
  return String(caddyfile || "").replace(/\{\$[A-Z0-9_]+:([^}]+)\}/g, "$1");
}

function validateLiveSnapshot(registry, snapshot) {
  const errors = [];
  const caddyfile = normalizeCaddyfile(snapshot?.caddyfile || "");
  const containers = snapshot?.containers || {};
  const health = snapshot?.health || {};

  for (const app of registry.apps || []) {
    for (const hostname of getRegisteredHostnames(app)) {
      if (!caddyfile.includes(hostname)) {
        errors.push(`Caddy route missing for ${hostname}`);
      }
    }

    if (app.docker?.edgeUpstream && !caddyfile.includes(app.docker.edgeUpstream)) {
      errors.push(`Caddy upstream missing for ${app.slug}: ${app.docker.edgeUpstream}`);
    }

    const containerName = app.docker?.appContainer;
    const container = containers[containerName];
    if (!container) {
      errors.push(`Container missing: ${containerName}`);
    } else {
      const actualNetworks = new Set(container.networks || []);
      for (const expectedNetwork of app.docker?.networks || []) {
        if (!actualNetworks.has(expectedNetwork)) {
          errors.push(`Container ${containerName} missing network ${expectedNetwork}`);
        }
      }

      for (const expectedPrefix of app.docker?.expectedMountSourcePrefixes || []) {
        const mountMatches = (container.mountSources || []).some((source) => source.startsWith(expectedPrefix));
        if (!mountMatches) {
          errors.push(`Container ${containerName} has no mount source under ${expectedPrefix}`);
        }
      }
    }

    const healthUrl = app.health?.url;
    if (healthUrl) {
      const result = health[healthUrl];
      if (!result) {
        errors.push(`Health check missing for ${healthUrl}`);
      } else if (result.status !== app.health.expectedStatus) {
        errors.push(`Health check ${healthUrl} returned ${result.status}, expected ${app.health.expectedStatus}`);
      }

      if (app.health.expectedDatabaseBackend && result?.json?.databaseBackend !== app.health.expectedDatabaseBackend) {
        errors.push(
          `Health check ${healthUrl} databaseBackend was ${result?.json?.databaseBackend}, expected ${app.health.expectedDatabaseBackend}`
        );
      }
    }
  }

  const unknownStatus = snapshot?.unknownWildcard?.status;
  if (unknownStatus !== undefined && unknownStatus < 400) {
    errors.push(`Unknown wildcard hostname did not fail closed; returned ${unknownStatus}`);
  }

  return errors;
}

function loadRegistry(registryPath) {
  return JSON.parse(fs.readFileSync(registryPath, "utf8"));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} ${args.join(" ")} failed`);
  }

  return result.stdout;
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

async function collectLiveSnapshot(registry, options = {}) {
  const host = options.host || registry.platform?.host || "mhv-server";
  const edgePath = registry.platform?.edge?.path || "/srv/edge/current";
  const caddyfile = run("ssh", [host, `sed -n '1,260p' ${edgePath}/Caddyfile`]);
  const containers = {};

  for (const app of registry.apps || []) {
    const containerName = app.docker?.appContainer;
    if (!containerName || containers[containerName]) continue;

    const inspectJson = run("ssh", [
      host,
      `docker inspect ${containerName} --format '{{json .}}'`
    ]);
    const inspect = JSON.parse(inspectJson);
    const networks = Object.keys(inspect.NetworkSettings?.Networks || {});
    const mountSources = (inspect.Mounts || []).map((mount) => mount.Source).filter(Boolean);
    containers[containerName] = { networks, mountSources };
  }

  const health = {};
  for (const app of registry.apps || []) {
    if (app.health?.url) {
      health[app.health.url] = await request(app.health.url);
    }
  }

  const unknownHostname = options.unknownHostname || `unknown-platform-check-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.${registry.platform?.domain || "mhvmade.com"}`;
  const unknownWildcard = await request(`https://${unknownHostname}`);

  return {
    caddyfile,
    containers,
    health,
    unknownWildcard
  };
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const hostIndex = args.indexOf("--host");
  const host = hostIndex >= 0 ? args[hostIndex + 1] : undefined;
  const registryArg = args.find((arg) => !arg.startsWith("--") && arg !== host);
  const registryPath = registryArg || path.resolve(__dirname, "..", "ops", "mhv-app-registry.json");
  const registry = loadRegistry(registryPath);
  const errors = validateRegistry(registry);

  if (errors.length === 0 && live) {
    const snapshot = await collectLiveSnapshot(registry, { host });
    errors.push(...validateLiveSnapshot(registry, snapshot));
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(error);
    }
    process.exit(1);
  }

  console.log(`Validated MHV app registry: ${registry.apps.length} apps${live ? " against live server" : ""}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  collectLiveSnapshot,
  validateLiveSnapshot,
  validateRegistry
};
