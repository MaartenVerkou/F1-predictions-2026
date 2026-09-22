const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");

function readView(name) {
  return fs.readFileSync(path.join(repoRoot, "views", name), "utf8");
}

test("admin feedback uses the shared context wrapper", () => {
  for (const view of [
    "admin_inputs.ejs",
    "admin_race_data.ejs",
    "admin_actuals.ejs",
    "admin_overview.ejs",
    "admin_questions.ejs",
    "admin_ideas.ejs",
    "admin_testing.ejs"
  ]) {
    assert.match(readView(view), /admin-feedback-context/, `${view} should use shared feedback context`);
  }
});

test("team lineup overview keeps the toolbar concise", () => {
  const view = readView("admin_inputs.ejs");
  const help = view.indexOf("admin-inputs-lineup-help");
  const toolbar = view.indexOf('data-table-toolbar="teams"');
  assert.equal(help, -1, "redundant lineup guidance should not take vertical space");
  assert.ok(toolbar >= 0);
  assert.match(view, /data-lineup-history-form/);
  assert.match(view, /data-lineup-history-status/);
  assert.match(view, /admin_inputs\.lineup_changes_pending/);
  assert.match(view, /class="admin-inputs-lineup-history-form"[\s\S]*name="historical_correction"/);
  assert.doesNotMatch(view, /admin-inputs-lineup-round-form/);
  assert.doesNotMatch(view, /admin-inputs-lineup-form/);
});

test("inputs exposes shared historical confirmation and advanced data states", () => {
  const view = readView("admin_inputs.ejs");
  assert.match(view, /data-admin-season-policy/);
  assert.match(view, /data-admin-history-dialog/);
  assert.match(view, /data-season-mutation/);
  assert.match(view, /assignment_history/);
  assert.doesNotMatch(view, /data-hide-until-selection/);
  assert.match(view, /data-table-edit disabled/);
  assert.match(view, /data-table-remove/);
  assert.match(view, /data-table-remove[^\n]*disabled/);
  assert.match(view, /admin-inputs-view-toolbar/);
  assert.doesNotMatch(view, /data-table-selection/);
  assert.match(view, /partials\/admin_inputs_tabs/);
  assert.match(view, /archived_policy_short/);
  assert.doesNotMatch(view, /admin-inputs-summary/);
  assert.doesNotMatch(view, /impact_summary/);
  assert.doesNotMatch(view, /season_active/);
  assert.doesNotMatch(view, /admin_inputs\.active/);
  const tabs = readView("partials/admin_inputs_tabs.ejs");
  assert.match(tabs, /admin-race-data-tabs/);
  assert.match(tabs, /data_quality/);
  assert.doesNotMatch(tabs, /assignments/);
});

test("race inputs show the localized scheduled start", () => {
  const view = readView("admin_inputs.ejs");
  assert.match(view, /admin_inputs\.race_start/);
  assert.match(view, /formatRaceStart/);
  assert.match(view, /scheduled_timezone/);
  assert.match(view, /colspan="4"/);
});

test("shared table styles define header and first-row boundaries", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(styles, /admin-feedback-context/);
  assert.match(styles, /admin-table-scroll > table thead th/);
  assert.match(styles, /tbody tr:first-child > th/);
  assert.match(styles, /border-bottom: 2px solid color-mix/);
});

test("lineup period metadata stays adjacent to the driver name", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  const periodRule = styles.match(/\.admin-lineup-period\s*\{([^}]*)\}/)?.[1] || "";
  assert.match(periodRule, /justify-content:\s*flex-end/);
  assert.match(periodRule, /min-width:\s*0/);
  assert.match(styles, /\.admin-lineup-period strong\s*\{[\s\S]*?flex:\s*0 1 auto/);
  assert.match(styles, /admin-inputs-team-col-driver/);
});

test("inputs toolbar actions use the same compact rhythm as the tabs", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(styles, /\.admin-inputs-view-toolbar \.admin-inputs-toolbar-end > button/);
  assert.match(styles, /\.admin-inputs-view-toolbar \.admin-inputs-toolbar-end > \.admin-inputs-advanced-link/);
  assert.match(styles, /min-height:\s*34px/);
  assert.match(styles, /border-radius:\s*999px/);
});
