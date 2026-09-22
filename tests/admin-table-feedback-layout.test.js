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

test("historical lineup warning is above the team toolbar", () => {
  const view = readView("admin_inputs.ejs");
  const warning = view.indexOf("admin-inputs-history-warning");
  const toolbar = view.indexOf('data-table-toolbar="teams"');
  assert.ok(warning >= 0);
  assert.ok(toolbar >= 0);
  assert.ok(warning < toolbar, "warning should not interrupt the toolbar/table gap");
  assert.match(view.slice(warning, toolbar), /form="admin-inputs-lineup-form"/);
});

test("shared table styles define header and first-row boundaries", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(styles, /admin-feedback-context/);
  assert.match(styles, /admin-table-scroll > table thead th/);
  assert.match(styles, /tbody tr:first-child > th/);
  assert.match(styles, /border-bottom: 2px solid color-mix/);
});
