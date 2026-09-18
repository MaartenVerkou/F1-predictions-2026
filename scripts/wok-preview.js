"use strict";

/**
 * WOK preview contract and lifecycle helpers.
 *
 * The descriptor/render functions are intentionally side-effect free so they can
 * be validated on a developer workstation. Server mutations are kept behind the
 * CLI and require an explicit preview id; production paths and credentials are
 * never read into the generated metadata.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const http = require("node:http");
const https = require("node:https");

const DEFAULT_RETENTION_DAYS = 7;
const PREVIEW_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
const PREVIEW_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\/-]*$/;
const PRODUCTION_HOST = "wheelofknowledge.com";

function isPresent(value) {
  return value !== undefined && value !== null && value !== "";
}

function validatePreviewId(value) {
  const id = String(value || "");
  if (!PREVIEW_ID_PATTERN.test(id) || id.includes("--")) {
    throw new Error("Invalid preview id: use 1-48 lowercase letters, numbers, and single hyphens");
  }
  return id;
}

function validatePreviewRef(value) {
  const ref = String(value || "");
  if (
    !PREVIEW_REF_PATTERN.test(ref) ||
    ref.includes("..") ||
    ref.includes("//") ||
    ref.includes("@{") ||
    ref.endsWith("/") ||
    ref.endsWith(".") ||
    ref.endsWith(".lock")
  ) {
    throw new Error("Invalid Git ref: provide an exact branch, tag, or commit ref without whitespace or control characters");
  }
  return ref;
}

function findWokApp(registry) {
  const app = (registry?.apps || []).find((candidate) => candidate.slug === "wok");
  if (!app) throw new Error("The MHV registry has no wok app entry");
  return app;
}

function addDays(iso, days) {
  return new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function resourceToken(id) {
  return id.replace(/-/g, "_");
}

function buildPreviewDescriptor(app, options = {}) {
  if (!app || app.slug !== "wok") throw new Error("A valid wok registry app is required");

  const id = validatePreviewId(options.id);
  const ref = validatePreviewRef(options.ref);
  const createdAt = new Date(options.now || Date.now()).toISOString();
  const retentionDays = Number(app.preview?.retentionDays || DEFAULT_RETENTION_DAYS);
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 30) {
    throw new Error("WOK preview retention must be between 1 and 30 days");
  }

  const root = app.preview?.root || `${path.posix.dirname(app.paths.currentProduction)}/previews`;
  const base = `${root}/${id}`;
  const token = resourceToken(id);
  const resourceName = `wok_preview_${token}`;
  const hostname = `wok-preview-${id}.mhvmade.com`;

  return {
    app: "wok",
    id,
    ref,
    createdAt,
    expiresAt: addDays(createdAt, retentionDays),
    hostname,
    productionHost: PRODUCTION_HOST,
    composeProject: `wok-preview-${id}`,
    containerName: `wok-preview-${id}`,
    worktree: `${base}/worktree`,
    stateDir: `${base}/state`,
    fileStateSource: app.state?.durableFilePaths?.[0] || null,
    metadataPath: `${base}/metadata.json`,
    composePath: `${base}/docker-compose.preview.yml`,
    envPath: `${base}/.env`,
    routePath: `${base}/Caddyfile.preview`,
    database: {
      host: app.database?.host || "mhv-postgres",
      network: app.database?.network || "mhv-db",
      source: app.database?.databaseKey,
      name: resourceName,
      role: resourceName
    },
    edge: {
      path: app.platform?.edgePath,
      container: app.platform?.edgeContainer || "mhv-caddy"
    },
    productionSafety: {
      productionHost: PRODUCTION_HOST,
      productionRoutePreserved: app.hostnames?.canonical === PRODUCTION_HOST,
      productionPath: app.paths?.currentProduction,
      productionDatabase: app.database?.databaseKey,
      productionDatabaseUntouched: true,
      productionFileStateUntouched: true,
      productionSecretsNotCopied: true
    },
    retentionDays,
    accessPolicy: "mhv-preview-access"
  };
}

function yamlQuote(value) {
  return JSON.stringify(String(value));
}

function renderComposeOverlay(descriptor, options = {}) {
  const localPort = options.localPort;
  const ports = localPort ? `\n    ports:\n      - \"127.0.0.1:${Number(localPort)}:3000\"` : "";
  return `name: ${descriptor.composeProject}

services:
  app:
    container_name: ${descriptor.containerName}
    build:
      context: ${yamlQuote(descriptor.worktree)}
    environment:
      NODE_ENV: production
      PORT: \"3000\"
      APP_DOMAIN: ${yamlQuote(descriptor.hostname)}
      TRUST_PROXY_HOPS: \"1\"
      DATA_DIR: /app/state
      DB_PATH: /app/state/app.db
      DATABASE_URL: $${"{WOK_PREVIEW_DATABASE_URL}"}
      SESSION_SECRET: $${"{WOK_PREVIEW_SESSION_SECRET}"}
      ADMIN_EMAILS: $${"{WOK_PREVIEW_ADMIN_EMAILS:-}"}
      DEV_AUTO_LOGIN: \"0\"
      QUESTIONS_PATH: /app/config/questions.json
      ROSTER_PATH: /app/config/roster.json
      RACES_PATH: /app/config/races.json
      LAST_SEASON_RESULTS_PATH: /app/config/last-season-results.json
      ACTUALS_AUTO_UPDATE_ENABLED: "0"
      ACTUALS_AUTO_UPDATE_ON_START: "0"
    volumes:
      - ${descriptor.stateDir}:/app/state
      - ${descriptor.worktree}/data:/app/config:ro
    networks:
      mhv-db:
      mhv-web:
        aliases:
          - ${descriptor.containerName}
    healthcheck:
      test: [\"CMD\", \"node\", \"-e\", \"fetch('http://127.0.0.1:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))\"]
      interval: 30s
      timeout: 5s
      start_period: 30s
      retries: 5${ports}

networks:
  mhv-db:
    external: true
  mhv-web:
    external: true
`;
}

function renderCaddyRoute(descriptor, options = {}) {
  const accessLine = options.accessUpstream
    ? `\n\tforward_auth ${options.accessUpstream} {\n\t\turi /verify\n\t}`
    : "";
  return `# MHV WOK PREVIEW ${descriptor.id}
# Cloudflare Access policy ${descriptor.accessPolicy} MUST protect this hostname before DNS is enabled.
${descriptor.hostname} {
\tencode zstd gzip
\theader {
\t\tX-Robots-Tag \"noindex, nofollow\"
\t\tX-Content-Type-Options \"nosniff\"
\t\tReferrer-Policy \"strict-origin-when-cross-origin\"
\t}
${accessLine}
\treverse_proxy ${descriptor.containerName}:3000
}
# END MHV WOK PREVIEW ${descriptor.id}
`;
}

function redactPreviewStatus(status) {
  const result = { ...status };
  delete result.env;
  delete result.secrets;
  if (result.database) {
    result.database = {
      name: result.database.name,
      role: result.database.role
    };
  }
  return result;
}

function randomSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function shell(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} failed`);
  }
  return result.stdout;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function serverShell(script, options = {}) {
  return shell("sh", ["-lc", script], options);
}

function postgresCommand(descriptor, sql) {
  const container = process.env.WOK_POSTGRES_CONTAINER || "mhv-postgres";
  return serverShell(
    `docker exec ${shellQuote(container)} sh -lc ${shellQuote(
      `psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c ${shellQuote(sql)}`
    )}`
  );
}

function clonePreviewDatabase(descriptor) {
  const source = descriptor.database.source;
  const target = descriptor.database.name;
  const role = descriptor.database.role;
  const password = randomSecret(32);
  if (!/^wok_preview_[a-z0-9_]+$/.test(target) || !/^wok_preview_[a-z0-9_]+$/.test(role)) {
    throw new Error("Refusing to create a database or role outside the WOK preview namespace");
  }

  const container = process.env.WOK_POSTGRES_CONTAINER || "mhv-postgres";
  const createRole = `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE \"${role}\" LOGIN PASSWORD '${password}'; ELSE ALTER ROLE \"${role}\" LOGIN PASSWORD '${password}'; END IF; END $$;`;
  const createDatabase = `if ! psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '${target}'" | grep -q 1; then psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c ${shellQuote(`CREATE DATABASE "${target}" OWNER "${role}"`)}; fi`;
  serverShell(
    `docker exec ${shellQuote(container)} sh -lc ${shellQuote(
      `psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c ${shellQuote(createRole)} && ${createDatabase}`
    )}`
  );

  const dumpRestore = [
    "set -eu",
    `docker exec ${shellQuote(container)} sh -lc ${shellQuote(
      `pg_dump -U "$POSTGRES_USER" -d ${source} --no-owner --no-acl`
    )} | docker exec -i ${shellQuote(container)} sh -lc ${shellQuote(
      `psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d ${target}`
    )}`,
    `docker exec ${shellQuote(container)} sh -lc ${shellQuote(
      `psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d ${target} -c ${shellQuote(
        `GRANT CONNECT ON DATABASE "${target}" TO "${role}"; GRANT USAGE, CREATE ON SCHEMA public TO "${role}"; GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${role}"; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${role}"; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${role}"; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${role}";`
      )}`
    )}`
  ].join("\n");
  serverShell(dumpRestore);
  return { password };
}

function clonePreviewFileState(app, descriptor) {
  const source = descriptor.fileStateSource;
  if (!source) return { cloned: false, source: null };
  if (!source.startsWith("/var/lib/wheelofknowledge/state")) {
    throw new Error(`Refusing to clone an unregistered WOK file-state path: ${source}`);
  }
  serverShell(
    `mkdir -p ${shellQuote(descriptor.stateDir)} && if [ -d ${shellQuote(source)} ]; then cp -a ${shellQuote(source)}/. ${shellQuote(descriptor.stateDir)}/; fi`
  );
  return { cloned: true, source };
}

function removePreviewDatabase(descriptor) {
  const target = descriptor.database.name;
  const role = descriptor.database.role;
  if (!/^wok_preview_[a-z0-9_]+$/.test(target) || !/^wok_preview_[a-z0-9_]+$/.test(role)) {
    throw new Error("Refusing to remove a database or role outside the WOK preview namespace");
  }
  const container = process.env.WOK_POSTGRES_CONTAINER || "mhv-postgres";
  const dropDatabase = `psql -v ON_ERROR_STOP=1 -U \"$POSTGRES_USER\" -d postgres -c ${shellQuote(`DROP DATABASE IF EXISTS \"${target}\" WITH (FORCE)`)} && psql -v ON_ERROR_STOP=1 -U \"$POSTGRES_USER\" -d postgres -c ${shellQuote(`DROP ROLE IF EXISTS \"${role}\"`)}`;
  serverShell(
    `docker exec ${shellQuote(container)} sh -lc ${shellQuote(
      dropDatabase
    )}`
  );
}

function composeCommand(descriptor, args) {
  const envFile = shellQuote(descriptor.envPath);
  const composeFile = shellQuote(descriptor.composePath);
  return `docker compose --project-name ${shellQuote(descriptor.composeProject)} --env-file ${envFile} --file ${composeFile} ${args}`;
}

function waitForPreviewHealth(descriptor, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = spawnSync("docker", ["inspect", "--format", "{{.State.Health.Status}}", descriptor.containerName], {
      encoding: "utf8"
    });
    if (result.status === 0 && result.stdout.trim() === "healthy") return { status: 200, checkedAt: new Date().toISOString() };
    if (result.status === 0 && result.stdout.trim() === "unhealthy") {
      const logs = spawnSync("docker", ["logs", "--tail", "40", descriptor.containerName], { encoding: "utf8" });
      const safeLogs = `${logs.stdout || ""}${logs.stderr || ""}`
        .replace(/postgres(?:ql)?:\/\/[^\s)]+/gi, "postgres://[REDACTED]")
        .replace(/(password\s*[=:]\s*)[^\s,}]+/gi, "$1[REDACTED]")
        .trim();
      const diagnosticLines = safeLogs
        .split(/\r?\n/)
        .filter((line) => /error|fatal|password|permission|connect|timeout|refused/i.test(line))
        .slice(0, 12)
        .join("\n")
        .slice(0, 4000);
      throw new Error(`WOK preview health check failed for ${descriptor.id}${diagnosticLines ? `\n${diagnosticLines}` : ""}`);
    }
    const wait = Math.min(5000, Math.max(100, deadline - Date.now()));
    if (wait > 0) spawnSync("sleep", [String(Math.ceil(wait / 1000))]);
  }
  throw new Error(`Timed out waiting for WOK preview health: ${descriptor.id}`);
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
        resolve({ status: res.statusCode || 0, json });
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve({ status: 0 }));
    req.end();
  });
}

function caddyfilePath(registry) {
  return path.posix.join(registry.platform?.edge?.path || "/srv/edge/current", "Caddyfile");
}

function activateCaddyRoute(registry, descriptor) {
  const filePath = caddyfilePath(registry);
  const current = fs.readFileSync(filePath, "utf8");
  const marker = `# MHV WOK PREVIEW ${descriptor.id}`;
  if (current.includes(marker)) throw new Error(`Caddy route already exists for WOK preview ${descriptor.id}`);
  if (current.includes(`${descriptor.hostname} {`)) throw new Error(`Caddy hostname already exists: ${descriptor.hostname}`);
  const next = `${current.trimEnd()}\n\n${renderCaddyRoute(descriptor)}`;
  const backup = `${filePath}.backup-wok-${descriptor.id}`;
  fs.copyFileSync(filePath, backup);
  fs.writeFileSync(filePath, next, { mode: 0o640 });
  try {
    serverShell(`docker exec ${shellQuote(descriptor.edge.container)} caddy validate --config /etc/caddy/Caddyfile`);
    serverShell(`docker exec ${shellQuote(descriptor.edge.container)} caddy reload --config /etc/caddy/Caddyfile`);
  } catch (error) {
    fs.copyFileSync(backup, filePath);
    throw error;
  } finally {
    fs.rmSync(backup, { force: true });
  }
}

function validatePreviewSmoke(descriptor, snapshot = {}) {
  const errors = [];
  if (!snapshot.routeInstalled) errors.push(`Caddy route missing for ${descriptor.hostname}`);
  if (!snapshot.accessProtection) errors.push(`Access protection is not confirmed for ${descriptor.hostname}`);
  if (snapshot.preview?.status !== undefined && ![200, 302, 401, 403].includes(snapshot.preview.status)) {
    errors.push(`Preview ${descriptor.hostname} returned unexpected status ${snapshot.preview.status}`);
  }
  if (snapshot.production?.status !== 200) {
    errors.push(`Production ${descriptor.productionHost} health returned ${snapshot.production?.status || 0}`);
  }
  if (snapshot.production?.json?.databaseBackend && snapshot.production.json.databaseBackend !== "postgres") {
    errors.push(`Production ${descriptor.productionHost} is not using PostgreSQL`);
  }
  return errors;
}

function removeCaddyRoute(registry, descriptor) {
  const filePath = caddyfilePath(registry);
  if (!fs.existsSync(filePath)) return false;
  const current = fs.readFileSync(filePath, "utf8");
  const pattern = new RegExp(`\\n?# MHV WOK PREVIEW ${descriptor.id}[\\s\\S]*?# END MHV WOK PREVIEW ${descriptor.id}\\n?`, "m");
  if (!pattern.test(current)) return false;
  const next = current.replace(pattern, "\n").replace(/\n{3,}/g, "\n\n");
  const backup = `${filePath}.backup-wok-${descriptor.id}`;
  fs.copyFileSync(filePath, backup);
  fs.writeFileSync(filePath, next, { mode: 0o640 });
  try {
    serverShell(`docker exec ${shellQuote(descriptor.edge.container)} caddy validate --config /etc/caddy/Caddyfile`);
    serverShell(`docker exec ${shellQuote(descriptor.edge.container)} caddy reload --config /etc/caddy/Caddyfile`);
  } catch (error) {
    fs.copyFileSync(backup, filePath);
    throw error;
  } finally {
    fs.rmSync(backup, { force: true });
  }
  return true;
}

function loadRegistry(registryPath = path.resolve(__dirname, "..", "ops", "mhv-app-registry.json")) {
  return JSON.parse(fs.readFileSync(registryPath, "utf8"));
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const values = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--json") values.json = true;
    else if (arg.startsWith("--")) values[arg.slice(2)] = rest[++index];
  }
  return values;
}

function writePrivate(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, content, { mode: 0o600 });
}

function metadataFromDescriptor(descriptor) {
  return {
    ...descriptor,
    status: "created",
    route: { active: false, accessPolicy: descriptor.accessPolicy },
    health: { status: "pending" },
    cleanup: { expiresAt: descriptor.expiresAt, state: "scheduled" }
  };
}

function createPreview(registry, app, options) {
  const descriptor = buildPreviewDescriptor(app, options);
  if (options.activateRoute && !options.accessConfirmed) {
    throw new Error("Refusing to activate a public preview route without --access-confirmed true");
  }
  const previewDir = path.posix.dirname(descriptor.metadataPath);
  if (fs.existsSync(descriptor.metadataPath)) throw new Error(`WOK preview already exists: ${descriptor.id}`);

  let databaseCreated = false;
  let worktreeCreated = false;
  let routeActivated = false;
  try {
    fs.mkdirSync(previewDir, { recursive: true, mode: 0o700 });
    shell("git", ["-C", app.paths.currentProduction, "fetch", "--prune", "origin", descriptor.ref]);
    // Use FETCH_HEAD from the just-completed fetch so a remote branch does not
    // need to exist as a local branch in the production checkout.
    shell("git", ["-C", app.paths.currentProduction, "worktree", "add", "--detach", descriptor.worktree, "FETCH_HEAD"]);
    worktreeCreated = true;
    fs.mkdirSync(descriptor.stateDir, { recursive: true, mode: 0o700 });
    const fileState = clonePreviewFileState(app, descriptor);

    databaseCreated = true;
    const { password } = clonePreviewDatabase(descriptor);
    const databaseUrl = `postgres://${descriptor.database.role}:${password}@${descriptor.database.host}:5432/${descriptor.database.name}`;
    writePrivate(descriptor.envPath, [
      `WOK_PREVIEW_DATABASE_URL=${databaseUrl}`,
      `WOK_PREVIEW_SESSION_SECRET=${randomSecret()}`,
      "WOK_PREVIEW_ADMIN_EMAILS=",
      "NODE_ENV=production",
      "DEV_AUTO_LOGIN=0",
      ""
    ].join("\n"));
    writePrivate(descriptor.composePath, renderComposeOverlay(descriptor));
    writePrivate(descriptor.routePath, renderCaddyRoute(descriptor));

    shell("sh", ["-lc", `${composeCommand(descriptor, "up -d --build")} >/dev/null`]);
    const health = waitForPreviewHealth(descriptor);
    const metadata = metadataFromDescriptor(descriptor);
    metadata.resolvedCommit = shell("git", ["-C", descriptor.worktree, "rev-parse", "HEAD"]).trim();
    metadata.fileState = fileState;
    metadata.status = "healthy";
    metadata.health = health;

    if (options.activateRoute) {
      activateCaddyRoute(registry, descriptor);
      routeActivated = true;
      metadata.status = "active";
      metadata.route = { active: true, accessPolicy: descriptor.accessPolicy };
    }
    writePrivate(descriptor.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
    return metadata;
  } catch (error) {
    if (options.keepFailed) {
      const failed = metadataFromDescriptor(descriptor);
      failed.status = "failed";
      failed.cleanup = { expiresAt: descriptor.expiresAt, state: "manual", error: String(error.message || error).slice(0, 1000) };
      try {
        writePrivate(descriptor.metadataPath, `${JSON.stringify(failed, null, 2)}\n`);
      } catch (_metadataError) {
        // Keep the original failure if the diagnostic metadata cannot be written.
      }
      throw error;
    }
    if (routeActivated) {
      try {
        removeCaddyRoute(registry, descriptor);
      } catch (_cleanupError) {
        // Preserve the original failure and leave the marker for operator cleanup.
      }
    }
    try {
      shell("sh", ["-lc", `${composeCommand(descriptor, "down --volumes --remove-orphans")} >/dev/null 2>&1 || true`]);
    } catch (_cleanupError) {
      // Preserve the original failure; status/cleanup can finish any partial runtime.
    }
    if (databaseCreated) {
      try {
        removePreviewDatabase(descriptor);
      } catch (_cleanupError) {
        // Preserve metadata directory for an operator to finish cleanup.
      }
    }
    if (worktreeCreated) {
      try {
        shell("git", ["-C", app.paths.currentProduction, "worktree", "remove", "--force", descriptor.worktree]);
      } catch (_cleanupError) {
        // Preserve the original failure.
      }
    }
    throw error;
  }
}

function readPreviewMetadata(app, id) {
  const safeId = validatePreviewId(id);
  const root = app.preview?.root || `${path.posix.dirname(app.paths.currentProduction)}/previews`;
  const metadataPath = path.posix.join(root, safeId, "metadata.json");
  if (!fs.existsSync(metadataPath)) throw new Error(`WOK preview does not exist: ${safeId}`);
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  if (metadata.app !== "wok" || metadata.id !== safeId) throw new Error(`Preview metadata identity mismatch: ${safeId}`);
  return metadata;
}

function removePreview(registry, app, id) {
  const metadata = readPreviewMetadata(app, id);
  const descriptor = buildPreviewDescriptor(app, {
    id: metadata.id,
    ref: metadata.ref,
    now: metadata.createdAt
  });
  if (metadata.route?.active) removeCaddyRoute(registry, descriptor);
  shell("sh", ["-lc", `${composeCommand(descriptor, "down --volumes --remove-orphans")} >/dev/null 2>&1 || true`]);
  removePreviewDatabase(descriptor);
  shell("git", ["-C", app.paths.currentProduction, "worktree", "remove", "--force", descriptor.worktree]);
  fs.rmSync(path.posix.dirname(descriptor.metadataPath), { recursive: true, force: false });
  return { id: descriptor.id, removed: true, productionHost: descriptor.productionHost };
}

function activatePreview(registry, app, id, accessConfirmed) {
  if (!accessConfirmed) throw new Error("Refusing to activate a public preview route without --access-confirmed true");
  const metadata = readPreviewMetadata(app, id);
  if (metadata.health?.status !== 200) throw new Error(`WOK preview is not healthy: ${metadata.id}`);
  const descriptor = buildPreviewDescriptor(app, { id: metadata.id, ref: metadata.ref, now: metadata.createdAt });
  activateCaddyRoute(registry, descriptor);
  metadata.status = "active";
  metadata.route = { active: true, accessPolicy: descriptor.accessPolicy };
  writePrivate(descriptor.metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

function listPreviewMetadata(app) {
  const root = app.preview?.root || `${path.posix.dirname(app.paths.currentProduction)}/previews`;
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      try {
        return readPreviewMetadata(app, entry.name);
      } catch (_error) {
        return undefined;
      }
    })
    .filter(Boolean);
}

function findExpiredPreviews(app, now = new Date()) {
  const timestamp = new Date(now).getTime();
  return listPreviewMetadata(app).filter((metadata) => new Date(metadata.expiresAt).getTime() <= timestamp);
}

function print(value, json) {
  console.log(json ? JSON.stringify(value, null, 2) : typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

async function cli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const registry = loadRegistry(args.registry);
  const app = findWokApp(registry);

  if (args.command === "plan") {
    const descriptor = buildPreviewDescriptor(app, { id: args.id, ref: args.ref, now: args.now });
    print(redactPreviewStatus(descriptor), args.json);
    return;
  }

  if (args.command === "render") {
    const descriptor = buildPreviewDescriptor(app, { id: args.id, ref: args.ref, now: args.now });
    const output = {
      descriptor: redactPreviewStatus(descriptor),
      compose: renderComposeOverlay(descriptor, { localPort: args["local-port"] }),
      caddy: renderCaddyRoute(descriptor)
    };
    print(output, true);
    return;
  }

  if (args.command === "status") {
    print(redactPreviewStatus(readPreviewMetadata(app, args.id)), args.json);
    return;
  }

  if (args.command === "create") {
    if (process.platform === "win32") throw new Error("Preview create must run on mhv-server; use plan or render locally");
    print(redactPreviewStatus(createPreview(registry, app, {
      id: args.id,
      ref: args.ref,
      now: args.now,
      activateRoute: args["activate-route"] === "true" || args["activate-route"] === true,
      accessConfirmed: args["access-confirmed"] === "true" || args["access-confirmed"] === true,
      keepFailed: args["keep-failed"] === "true" || args["keep-failed"] === true
    })), args.json);
    return;
  }

  if (args.command === "remove") {
    if (process.platform === "win32") throw new Error("Preview removal must run on mhv-server");
    print(removePreview(registry, app, args.id), args.json);
    return;
  }

  if (args.command === "activate") {
    if (process.platform === "win32") throw new Error("Preview activation must run on mhv-server");
    print(redactPreviewStatus(activatePreview(
      registry,
      app,
      args.id,
      args["access-confirmed"] === "true" || args["access-confirmed"] === true
    )), args.json);
    return;
  }

  if (args.command === "cleanup") {
    if (process.platform === "win32") throw new Error("Preview cleanup must run on mhv-server");
    const expired = findExpiredPreviews(app, args.now || new Date());
    if (args.apply !== "true" && args.apply !== true) {
      print({ expired: expired.map(redactPreviewStatus), applied: false }, args.json);
      return;
    }
    const removed = expired.map((metadata) => removePreview(registry, app, metadata.id));
    print({ expired: expired.map((metadata) => metadata.id), removed, applied: true }, args.json);
    return;
  }

  if (args.command === "smoke") {
    const metadata = readPreviewMetadata(app, args.id);
    const descriptor = buildPreviewDescriptor(app, { id: metadata.id, ref: metadata.ref, now: metadata.createdAt });
    const health = waitForPreviewHealth(descriptor, 5000);
    const [preview, production] = await Promise.all([
      request(`https://${descriptor.hostname}/healthz`),
      request(`https://${descriptor.productionHost}/healthz`)
    ]);
    const smoke = {
      routeInstalled: metadata.route?.active === true,
      accessProtection: metadata.route?.accessPolicy === descriptor.accessPolicy,
      preview: { ...preview, internalHealth: health },
      production
    };
    const errors = validatePreviewSmoke(descriptor, smoke);
    if (errors.length > 0) throw new Error(errors.join("\n"));
    print({ ...redactPreviewStatus(metadata), smoke }, args.json);
    return;
  }

  throw new Error("Usage: node scripts/wok-preview.js <plan|render|status|create|activate|remove|cleanup|smoke> --id <id> [--ref <ref>] [--access-confirmed true] [--json]");
}

if (require.main === module) {
  Promise.resolve(cli()).catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  buildPreviewDescriptor,
  createPreview,
  activatePreview,
  findWokApp,
  loadRegistry,
  redactPreviewStatus,
  removePreview,
  findExpiredPreviews,
  listPreviewMetadata,
  renderCaddyRoute,
  renderComposeOverlay,
  validatePreviewSmoke,
  validatePreviewId,
  validatePreviewRef
};
