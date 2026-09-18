"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  buildPreviewDescriptor,
  renderCaddyRoute,
  renderComposeOverlay,
  redactPreviewStatus,
  validatePreviewId,
  validatePreviewRef,
  validatePreviewDataMode,
  validatePreviewSmoke
} = require("../scripts/wok-preview");

const registry = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "..", "ops", "mhv-app-registry.json"), "utf8")
);
const wok = registry.apps.find((app) => app.slug === "wok");

test("builds an isolated WOK preview descriptor from an exact ref", () => {
  const descriptor = buildPreviewDescriptor(wok, {
    id: "admin-race-review-20260918",
    ref: "codex/streamline-admin-race-result-review",
    now: "2026-09-18T10:00:00.000Z"
  });

  assert.equal(descriptor.app, "wok");
  assert.equal(descriptor.ref, "codex/streamline-admin-race-result-review");
  assert.equal(descriptor.dataMode, "sanitized");
  assert.equal(descriptor.hostname, "wok-preview-admin-race-review-20260918.mhvmade.com");
  assert.equal(descriptor.productionHost, "wheelofknowledge.com");
  assert.equal(descriptor.composeProject, "wok-preview-admin-race-review-20260918");
  assert.equal(descriptor.database.name, "wok_preview_admin_race_review_20260918");
  assert.equal(descriptor.database.role, "wok_preview_admin_race_review_20260918");
  assert.match(descriptor.worktree, /[\\/]previews[\\/]admin-race-review-20260918[\\/]worktree$/);
  assert.equal(descriptor.expiresAt, "2026-09-25T10:00:00.000Z");
  assert.equal(descriptor.productionSafety.productionRoutePreserved, true);
  assert.equal(descriptor.productionSafety.productionDatabaseUntouched, true);
});

test("rejects unsafe preview ids and refs", () => {
  assert.throws(() => validatePreviewId("../production"), /preview id/i);
  assert.throws(() => validatePreviewId("WOK-Preview"), /preview id/i);
  assert.throws(() => validatePreviewRef("codex/preview\nrm -rf"), /ref/i);
  assert.throws(() => validatePreviewRef(""), /ref/i);
  assert.throws(() => buildPreviewDescriptor(wok, { id: "review-1", ref: "main", localPort: 80 }), /local preview port/i);
  assert.throws(() => validatePreviewDataMode("production"), /data mode/i);
});

test("renders explicit protected route without changing the production host", () => {
  const descriptor = buildPreviewDescriptor(wok, {
    id: "review-1",
    ref: "main",
    now: "2026-09-18T10:00:00.000Z"
  });
  const route = renderCaddyRoute(descriptor);

  assert.match(route, /wok-preview-review-1\.mhvmade\.com/);
  assert.match(route, /Cloudflare Access policy mhv-preview-access/);
  assert.match(route, /reverse_proxy wok-preview-review-1:3000/);
  assert.doesNotMatch(route, /wheelofknowledge\.com/);
});

test("renders an isolated compose overlay without production secrets", () => {
  const descriptor = buildPreviewDescriptor(wok, {
    id: "review-1",
    ref: "main",
    now: "2026-09-18T10:00:00.000Z"
  });
  const compose = renderComposeOverlay(descriptor);

  assert.match(compose, /name: wok-preview-review-1/);
  assert.match(compose, /DATABASE_URL: \$\{WOK_PREVIEW_DATABASE_URL\}/);
  assert.match(compose, /SESSION_SECRET: \$\{WOK_PREVIEW_SESSION_SECRET\}/);
  assert.match(compose, /NODE_ENV: development/);
  assert.match(compose, /DEV_AUTO_LOGIN: "1"/);
  assert.match(compose, /WOK_PREVIEW_DATA_MODE: "sanitized"/);
  assert.match(compose, /mhv-db/);
  assert.match(compose, /mhv-web/);
  assert.doesNotMatch(compose, /f1_predictions/);
  assert.doesNotMatch(compose, /wheelofknowledge\.com/);
});

test("clone previews cannot render or activate a public route", () => {
  const descriptor = buildPreviewDescriptor(wok, {
    id: "private-clone",
    ref: "main",
    dataMode: "clone",
    now: "2026-09-18T10:00:00.000Z"
  });
  assert.equal(descriptor.dataMode, "clone");
  assert.throws(() => renderCaddyRoute(descriptor), /sanitized/i);
  const compose = renderComposeOverlay(descriptor);
  assert.match(compose, /NODE_ENV: production/);
  assert.match(compose, /DEV_AUTO_LOGIN: "0"/);
});

test("status redaction never exposes credentials", () => {
  const status = redactPreviewStatus({
    id: "review-1",
    database: { name: "wok_preview_review_1", role: "wok_preview_review_1", password: "do-not-print" },
    env: { DATABASE_URL: "postgres://wok_preview:do-not-print@mhv-postgres/db", SESSION_SECRET: "secret" },
    health: { status: 200 }
  });

  assert.deepEqual(status.database, { name: "wok_preview_review_1", role: "wok_preview_review_1" });
  assert.equal("env" in status, false);
  assert.doesNotMatch(JSON.stringify(status), /do-not-print|secret/);
});

test("smoke validation requires protected preview and healthy PostgreSQL production", () => {
  const descriptor = buildPreviewDescriptor(wok, { id: "review-1", ref: "main", now: "2026-09-18T10:00:00.000Z" });
  assert.deepEqual(
    validatePreviewSmoke(descriptor, {
      routeInstalled: true,
      accessProtection: true,
      preview: { status: 302 },
      production: { status: 200, json: { databaseBackend: "postgres" } }
    }),
    []
  );
  assert.match(
    validatePreviewSmoke(descriptor, {
      routeInstalled: false,
      accessProtection: false,
      preview: { status: 200 },
      production: { status: 503, json: { databaseBackend: "sqlite" } }
    }).join("\n"),
    /Caddy route missing|Access protection|returned 503|not using PostgreSQL/
  );
});
