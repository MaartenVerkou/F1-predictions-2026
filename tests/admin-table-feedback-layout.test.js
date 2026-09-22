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

test("team lineup overview explains periods before the team toolbar", () => {
  const view = readView("admin_inputs.ejs");
  const help = view.indexOf("admin-inputs-lineup-help");
  const toolbar = view.indexOf('data-table-toolbar="teams"');
  assert.ok(help >= 0);
  assert.ok(toolbar >= 0);
  assert.ok(help < toolbar, "lineup guidance should stay above the toolbar");
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
  assert.match(view, /data_quality/);
  assert.match(view, /data-hide-until-selection/);
  assert.match(view, /archived_policy_short/);
  assert.doesNotMatch(view, /admin-inputs-summary/);
  assert.doesNotMatch(view, /impact_summary/);
  const navigation = view.slice(view.indexOf('<nav class="admin-inputs-tabs"'), view.indexOf('</nav>') + 6);
  assert.doesNotMatch(navigation, /assignments/);
});

test("shared table styles define header and first-row boundaries", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(styles, /admin-feedback-context/);
  assert.match(styles, /admin-table-scroll > table thead th/);
  assert.match(styles, /tbody tr:first-child > th/);
  assert.match(styles, /border-bottom: 2px solid color-mix/);
});
