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

test("admin actuals is a read-only season overview", () => {
  const view = readView("admin_actuals.ejs");
  assert.doesNotMatch(view, /autofill-current-season/);
  assert.doesNotMatch(view, /preview_autofill/);
  assert.match(view, /admin-race-data-selector-form admin-actuals-season-form/);
  assert.match(view, /data-admin-actuals-form/);
  assert.doesNotMatch(view, /admin-actuals-source-note|overview_source|pending_rounds|published_through|no_published_snapshot/);
  assert.match(view, /admin-actuals-question-view-link/);
  assert.match(view, /encodeURIComponent\(row\.question\.id\)/);
  assert.match(view, /row\.focusLabel/);
  assert.match(view, /cell\.displayLines/);
  assert.match(view, /cell\.displayMode/);
  assert.match(view, /target\.raceName/);
  assert.match(view, /target\.raceCode/);
  assert.match(view, /admin-actuals-question-content/);
  assert.match(view, /admin-actuals-value-line/);
  assert.doesNotMatch(view, /data-admin-actuals-target-form/);
  assert.doesNotMatch(view, /name="target"/);
  assert.doesNotMatch(view, /admin\/actuals\/review/);
  assert.doesNotMatch(view, /run-auto-update/);
  assert.doesNotMatch(view, /Mark this snapshot reviewed/);
});

test("season actuals keeps question prompts compact and readable on small screens", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  const promptRule = styles.match(/\.admin-actuals-question-prompt\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(promptRule, /-webkit-line-clamp:\s*2/);
  assert.match(promptRule, /white-space:\s*normal/);
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*?\.admin-actuals-question-column,[\s\S]*?min-width:\s*136px/);
  assert.match(styles, /\.admin-actuals-question-prompt-short\s*\{[\s\S]*?display:\s*none/);
});

test("season actuals uses shared short question labels on narrow screens", () => {
  const view = readView("admin_actuals.ejs");
  assert.match(view, /admin-actuals-question-prompt-full/);
  assert.match(view, /admin-actuals-question-prompt-short/);
  assert.match(view, /aria-label="<%= row\.question\.prompt %>"/);
  assert.match(view, /row\.shortPrompt/);
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*?\.admin-actuals-question-prompt-full\s*\{[\s\S]*?display:\s*none/);
  assert.match(styles, /@media \(max-width: 480px\)[\s\S]*?\.admin-actuals-question-prompt-short\s*\{[\s\S]*?display:\s*block/);
});

test("season actuals bounds answer content with a shared compact projection", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  const tableRule = styles.match(/\.admin-actuals-overview-table\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(tableRule, /--admin-actuals-max-value-lines:\s*2/);
  assert.match(styles, /\.admin-actuals-value-cell a\s*\{[\s\S]*?max-height:\s*calc\(1\.2em \* var\(--admin-actuals-max-value-lines\)\)/);
  assert.match(styles, /\.admin-actuals-value-line\.is-codes\s*\{[\s\S]*?font-size:\s*11px/);
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

test("drivers table shows profile metadata without duplicating team assignments", () => {
  const view = readView("admin_inputs.ejs");
  const start = view.indexOf('admin-inputs-driver-table');
  const end = view.indexOf('data-selectable-table="teams"');
  const driversView = view.slice(start, end);
  assert.match(driversView, /admin-inputs-driver-table/);
  assert.match(driversView, /driver_code/);
  assert.match(driversView, /nationality_code/);
  assert.match(driversView, /date_of_birth/);
  assert.match(driversView, /driver\.age/);
  assert.doesNotMatch(driversView, /assignment\?\.team_name/);
  assert.match(driversView, /colspan="5"/);
});

test("teams table exposes compact power-unit metadata and editor input", () => {
  const view = readView("admin_inputs.ejs");
  const start = view.indexOf('data-selectable-table="teams"');
  const end = view.indexOf('data-selectable-table="races"');
  const teamsView = view.slice(start, end);
  assert.match(teamsView, /power_unit/);
  assert.match(teamsView, /power_unit_short/);
  assert.match(teamsView, /maxlength="3" pattern="\[A-Za-z\]\{3\}"/);
  assert.match(view, /name="base_country_code"[\s\S]*?maxlength="3" pattern="\[A-Za-z\]\{3\}"/);
});

test("all input tables use explicit responsive table variants", () => {
  const view = readView("admin_inputs.ejs");
  assert.match(view, /admin-inputs-driver-table/);
  assert.match(view, /admin-inputs-team-table/);
  assert.match(view, /admin-inputs-race-table/);
  assert.match(view, /admin-inputs-mapping-table/);
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(styles, /\.admin-inputs-data-table-wrap\s*\{[\s\S]*?max-width:\s*100%/);
  assert.match(styles, /\.admin-inputs-race-table\s*\{/);
  assert.match(styles, /\.admin-inputs-mapping-table\s*\{/);
  assert.match(styles, /\.admin-inputs-page \.admin-inputs-view-toolbar\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
});

test("scoring rules live in a dedicated Inputs sub-section", () => {
  const view = readView("admin_inputs.ejs");
  const tabs = readView("partials/admin_inputs_tabs.ejs");
  assert.match(tabs, /\['drivers', 'teams', 'races', 'scoring'\]/);
  assert.match(view, /tab === 'scoring'/);
  assert.match(view, /admin-inputs-scoring-overview/);
  const scoringStart = view.indexOf("tab === 'scoring'");
  const driversStart = view.indexOf("tab === 'drivers'");
  assert.ok(scoringStart >= 0 && driversStart > scoringStart);
  assert.ok(view.slice(scoringStart, driversStart).includes("admin-inputs-scoring-overview"));
});

test("race data views share one identity column and a common row rhythm", () => {
  const page = readView("admin_race_data.ejs");
  const region = readView("partials/admin_race_data_round_region.ejs");
  const row = readView("partials/admin_race_data_matrix_row.ejs");
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(page, /partials\/admin_race_data_round_region/);
  assert.match(region, /<tbody data-race-data-body="<%= viewMode %>">/);
  assert.equal((region.match(/data-race-data-body=/g) || []).length, 1);
  assert.match(page, /admin-race-data-selector-stack/);
  assert.match(page, /admin_race_data\.season_overview/);
  assert.match(page, /raceDataError \|\| raceDataSuccess/);
  assert.match(page, /class="admin-race-data-selector-form admin-race-data-round-form" data-race-data-round-form/);
  assert.doesNotMatch(region, /class="admin-race-data-controls"/);
  assert.match(region, /questions_label/);
  assert.match(region, /data-race-data-round-link/);
  assert.match(region, /option\.id === view\.activeMetricId/);
  assert.match(region, /admin-race-data-metric-tab <%= option\.id === view\.activeMetricId \? 'is-active' : '' %>/);
  assert.match(region, /class="admin-race-data-table-section"/);
  assert.match(region, /admin_race_data\.championship_standings/);
  assert.doesNotMatch(region, /admin_race_data\.race_result/);
  assert.match(region, /admin-race-data-section-heading/);
  assert.match(region, /view\.hasSelectedRound/);
  assert.match(region, /roundQuery/);
  assert.match(region, /admin-race-data-evidence-meta/);
  assert.match(region, /admin-race-data-legend/);
  assert.doesNotMatch(region, /admin-race-data-revision-meta/);
  assert.match(region, /class="admin-race-data-table-toolbar"/);
  assert.doesNotMatch(region, /admin-race-data-toolbar/);
  assert.doesNotMatch(region, /open_actuals|derived_actuals|derivedActuals/);
  assert.match(region, /data-race-data-result-row/);
  assert.match(region, /data-race-data-edit disabled/);
  assert.match(region, /action="\/admin\/race-data\/review"/);
  assert.match(region, /name="returnTo"/);
  assert.match(region, /data-race-data-review-status/);
  assert.match(region, /admin_race_data_entity_label/);
  assert.match(region, /round\.code/);
  assert.match(region, /option\.shortLabel/);
  assert.doesNotMatch(region, /admin-race-data-edit-column/);
  assert.match(region, /data-race-data-editor/);
  assert.match(region, /resultColumns\.forEach/);
  assert.match(region, /column\.id === 'finish'/);
  assert.match(row, /rowspan="<%= groupSize %>" class="admin-race-data-sticky admin-race-data-entity admin-race-data-constructor-detail"/);
  assert.doesNotMatch(row, /admin-race-data-constructor-driver/);
  assert.doesNotMatch(row, /admin-race-data-team-detail/);
  assert.doesNotMatch(row, /admin-race-data-driver-detail/);
  assert.match(styles, /\.admin-race-data-matrix th,[\s\S]*?line-height:\s*1\.25/);
  assert.match(styles, /\.admin-race-data-controls\s*\{/);
  assert.match(styles, /\.admin-race-data-table-section\s*\{/);
  assert.match(styles, /\.admin-race-data-table-toolbar\s*\{/);
  assert.match(styles, /\.admin-race-data-section-heading\s*\{/);
  assert.match(styles, /\.admin-race-data-section-heading h2\s*\{/);
  const roundRegionStyles = styles.match(/\.admin-race-data-round-region\s*\{([\s\S]*?)\n\}/);
  assert.ok(roundRegionStyles, "race data round region styles should be explicit");
  assert.match(roundRegionStyles[1], /gap:\s*24px/);
  const championshipStyles = styles.match(/\.admin-race-data-table-section\[data-race-data-championship\]\s*\{([\s\S]*?)\n\}/);
  assert.ok(championshipStyles, "championship section styles should be explicit");
  assert.match(championshipStyles[1], /margin-top:\s*0/);
  assert.match(championshipStyles[1], /padding-top:\s*0/);
  assert.doesNotMatch(championshipStyles[1], /border-top/);
  const derivationStyles = styles.match(/\.admin-race-data-derivation\s*\{([\s\S]*?)\n\}/);
  assert.ok(derivationStyles, "derivation section styles should be explicit");
  assert.doesNotMatch(derivationStyles[1], /border-top|padding-top/);
  const app = fs.readFileSync(path.join(repoRoot, "public", "app.js"), "utf8");
  assert.match(app, /data-race-data-round-form\] select\[name="round"\]/);
  assert.match(app, /roundSelect\.value = round \|\| ''/);
  assert.match(styles, /\.admin-race-data-review-form\s*\{/);
  assert.match(styles, /\.admin-race-data-detail-table--result \.admin-race-data-result-cell--driver \.admin-race-data-compact-label/);
  assert.doesNotMatch(styles, /\.admin-race-data-team\s*\{/);
});

test("inputs exposes shared historical confirmation and advanced data states", () => {
  const view = readView("admin_inputs.ejs");
  assert.match(view, /data-admin-season-policy/);
  assert.match(view, /data-admin-history-dialog/);
  assert.match(view, /data-season-mutation/);
  assert.doesNotMatch(view, /tab=assignments/);
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
  assert.match(view, /formatRaceOffset/);
  assert.match(view, /timeZoneName: 'shortOffset'/);
  assert.match(view, /scheduled_timezone/);
  assert.match(view, /\(<%= raceOffset %>\)/);
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
  assert.match(periodRule, /justify-content:\s*flex-start/);
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

test("race data matrix palette follows the active theme", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  const lightMatrixRule = styles.match(/\.admin-race-data-matrix\s*\{([^}]*)\}/)?.[1] || "";
  assert.match(lightMatrixRule, /--card:\s*#ffffff/);
  assert.match(
    styles,
    /:root\[data-theme="dark"\]\s+\.admin-race-data-matrix\s*\{[\s\S]*?--card:\s*#0f1730/
  );
});

test("race data matrix exposes shared compact width variables", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  const matrixRule = styles.match(/\.admin-race-data-matrix\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(matrixRule, /--admin-race-entity-width/);
  assert.match(matrixRule, /--admin-race-round-width/);
  assert.match(matrixRule, /--admin-race-summary-width/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*?--admin-race-summary-width:\s*50px/);
});

test("race data variant switches share the bordered segmented shell", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  const switchRule = styles.match(/\.admin-race-data-switch\s*\{([\s\S]*?)\}/)?.[1] || "";
  assert.match(switchRule, /border:\s*1px solid var\(--border\)/);
  assert.match(switchRule, /border-radius:\s*8px/);
  assert.match(styles, /\.admin-race-data-metric-tabs[^}]*overflow-x:\s*auto/);
  const metricRule = styles.match(/\.admin-race-data-metric-tabs\s*\{([\s\S]*?)\}/)?.[1] || "";
  assert.doesNotMatch(metricRule, /padding-bottom/);
});

test("race data question metadata uses the Actuals subtitle treatment", () => {
  const view = readView("partials/admin_race_data_round_region.ejs");
  assert.match(view, /admin-race-data-question-picker/);
  assert.match(view, /admin-race-data-question-meta/);
  assert.match(view, /selectedQuestionTableLabel/);
  assert.match(view, /selectedQuestionFocusLabel/);

  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  const metaRule = styles.match(/\.admin-race-data-question-meta\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(metaRule, /color:\s*var\(--muted\)/);
  assert.match(metaRule, /font-size:\s*10px/);
  assert.match(metaRule, /font-weight:\s*600/);
  assert.match(metaRule, /text-overflow:\s*ellipsis/);
});
