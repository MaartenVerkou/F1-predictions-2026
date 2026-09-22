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
  assert.doesNotMatch(view, /admin-inputs-lineup-round-form/);
  assert.doesNotMatch(view, /admin-inputs-lineup-form/);
});

test("shared table styles define header and first-row boundaries", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(styles, /admin-feedback-context/);
  assert.match(styles, /admin-table-scroll > table thead th/);
  assert.match(styles, /tbody tr:first-child > th/);
  assert.match(styles, /border-bottom: 2px solid color-mix/);
});
