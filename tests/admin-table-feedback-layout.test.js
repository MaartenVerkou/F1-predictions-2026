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
    "admin_results.ejs",
    "admin_overview.ejs",
    "admin_questions.ejs",
    "admin_ideas.ejs",
    "admin_testing.ejs"
  ]) {
    assert.match(readView(view), /admin-feedback-context/, `${view} should use shared feedback context`);
  }
});

test("Questions edit mode exposes in-place order controls", () => {
  const view = readView("admin_questions.ejs");
  const app = fs.readFileSync(path.join(repoRoot, "public", "app.js"), "utf8");
  assert.match(view, /data-question-order-table/);
  assert.match(view, /data-question-order-row/);
  assert.match(view, /data-question-order-move="up"/);
  assert.match(view, /data-question-order-move="down"/);
  assert.match(view, /type="button"/);
  assert.match(app, /const initQuestionOrderControls/);
  assert.match(app, /body\.insertBefore\(row, nextRow\)/);
  assert.match(app, /body\.insertBefore\(nextRow, row\)/);
});

test("Questions and Results use separate season-aware surfaces", () => {
  const view = readView("admin_questions.ejs");
  const resultsPage = readView("admin_results.ejs");
  const results = readView("partials/admin_question_results.ejs");
  const questionCell = readView("partials/admin_actuals_question_cell.ejs");
  const nav = readView("partials/admin_nav.ejs");
  assert.match(view, /admin-questions-season-form/);
  assert.match(view, /name="season"/);
  assert.match(view, /admin-question-table-region/);
  assert.match(view, /admin-race-data-detail-toolbar/);
  assert.match(view, /admin-question-edit-button/);
  assert.doesNotMatch(view, /admin_question_results/);
  assert.match(resultsPage, /action="\/admin\/results"/);
  assert.match(resultsPage, /partials\/admin_question_results/);
  assert.doesNotMatch(view, /Wording, order, scoring and inclusion/);
  assert.match(results, /admin-actuals-overview-table/);
  assert.match(results, /admin_actuals_question_cell/);
  assert.match(questionCell, /admin-actuals-question-short-link/);
  assert.match(questionCell, /row\.question\.prompt/);
  assert.match(nav, /active === 'questions'/);
  assert.match(nav, /active === 'results'/);
  assert.match(nav, /href="\/admin\/results/);
  assert.ok(nav.indexOf('nav_race_data') < nav.indexOf('nav_questions'), "Race Data should precede Questions");
});

test("admin results is a read-only season overview", () => {
  const view = readView("admin_results.ejs");
  const resultsTable = readView("partials/admin_question_results.ejs");
  const questionCell = readView("partials/admin_actuals_question_cell.ejs");
  assert.doesNotMatch(view, /autofill-current-season/);
  assert.doesNotMatch(view, /preview_autofill/);
  assert.match(view, /admin-race-data-selector-form admin-actuals-season-form/);
  assert.match(view, /partials\/admin_question_results/);
  assert.doesNotMatch(view, /admin-actuals-source-note|overview_source|pending_rounds|published_through|no_published_snapshot/);
  assert.match(resultsTable, /admin_actuals_question_cell/);
  assert.match(questionCell, /admin-actuals-question-short-link/);
  assert.match(questionCell, /encodeURIComponent\(row\.question\.id\)/);
  assert.match(questionCell, /row\.focusLabel/);
  assert.match(resultsTable, /cell\.displayText/);
  assert.match(resultsTable, /cell\.value/);
  assert.match(resultsTable, /target\.raceName/);
  assert.match(resultsTable, /target\.raceCode/);
  assert.match(resultsTable, /admin-actuals-review-marker/);
  assert.match(resultsTable, /admin-actuals-round-header/);
  assert.doesNotMatch(resultsTable, /const statusLabel|admin-actuals-round-column small|is-pending/);
  assert.match(resultsTable, /admin-actuals-value/);
  assert.doesNotMatch(resultsTable, /displayLines|displayMode|admin-actuals-value-line/);
  assert.doesNotMatch(resultsTable, /data-admin-actuals-target-form/);
  assert.doesNotMatch(resultsTable, /name="target"/);
  assert.doesNotMatch(resultsTable, /admin\/actuals\/review/);
  assert.doesNotMatch(resultsTable, /run-auto-update/);
  assert.doesNotMatch(resultsTable, /Mark this snapshot reviewed/);
});

test("season results keep the question key compact while preserving a full tooltip", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(styles, /--admin-actuals-question-width:\s*58px/);
  assert.match(styles, /--admin-actuals-value-width:\s*72px/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?--admin-actuals-value-width:\s*clamp\(64px, 9\.5vw, 68px\)/);
  assert.doesNotMatch(styles, /@media \(max-width: 480px\)/);
  assert.match(styles, /\.admin-actuals-question-short-link\s*\{[\s\S]*?font-weight:\s*700/);
  assert.match(styles, /\.admin-actuals-question-column,\s*\n\.admin-actuals-question-cell\s*\{[\s\S]*?min-width:\s*var\(--admin-actuals-question-width\)/);
  assert.doesNotMatch(styles, /admin-actuals-question-prompt/);
  assert.doesNotMatch(styles, /admin-actuals-question-view-link/);
  assert.doesNotMatch(styles, /admin-actuals-value-line/);
  assert.match(styles, /\.admin-actuals-review-marker\s*\{/);
  assert.match(styles, /\.admin-actuals-round-header\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.doesNotMatch(styles, /admin-actuals-round-column\.is-pending|admin-actuals-value-cell\.is-pending/);
  assert.match(styles, /admin-actuals-value-cell a[\s\S]*?-webkit-line-clamp:\s*var\(--admin-actuals-max-value-lines\)/);
  assert.match(styles, /admin-actuals-value[\s\S]*?overflow-wrap:\s*inherit/);
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
  assert.match(styles, /\.admin-inputs-page \.admin-table-scroll\s*\{[\s\S]*?max-width:\s*100%/);
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
  assert.match(view, /admin-inputs-scoring-section/);
  assert.match(view, /admin-inputs-scoring-table/);
  assert.match(view, /label: 'Race'/);
  assert.match(view, /label: 'Sprint'/);
  assert.match(view, /admin-inputs-scoring-source/);
  assert.doesNotMatch(view, /Scoring rules/);
  assert.doesNotMatch(view, /admin-inputs-scoring-overview/);
  const scoringStart = view.indexOf("tab === 'scoring'");
  const driversStart = view.indexOf("tab === 'drivers'");
  assert.ok(scoringStart >= 0 && driversStart > scoringStart);
  assert.ok(view.slice(scoringStart, driversStart).includes("admin-inputs-scoring-section"));
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(styles, /\.admin-inputs-scoring-sections\s*\{/);
  assert.match(styles, /\.admin-inputs-scoring-table\s*\{/);
  assert.match(styles, /\.admin-inputs-scoring-sections\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.doesNotMatch(styles, /\.admin-inputs-scoring-overview\s*\{/);
});

test("hidden input helper forms do not create spacing between toolbar and tables", () => {
  const view = readView("admin_inputs.ejs");
  assert.match(view, /id="admin-inputs-new-driver-form"[^>]*\bhidden\b/);
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(styles, /form\[hidden\]\s*\{[\s\S]*?display:\s*none\s*!important/);
  assert.match(styles, /\.admin-inputs-page \.admin-table-scroll\s*\{[\s\S]*?margin-top:\s*8px/);
  assert.match(styles, /\.admin-inputs-page \.admin-inputs-scoring\s*\{[\s\S]*?margin-top:\s*8px/);
});

test("definitions keep the edit toolbar above a compact wrapped table", () => {
  const view = readView("admin_inputs.ejs");
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(view, /admin-inputs-definitions-table <%= definitionMode === 'edit' \? 'is-editing' : '' %>/);
  assert.match(view, /admin-definition-col-explanation/);
  assert.match(view, /admin-definition-col-aliases/);
  assert.match(styles, /\.admin-inputs-table\.admin-inputs-definitions-table\s*\{[\s\S]*?table-layout:\s*fixed/);
  assert.match(styles, /\.admin-inputs-table\.admin-inputs-definitions-table\.is-editing\s*\{[\s\S]*?width:\s*920px/);
  assert.match(styles, /\.admin-inputs-definitions-table \.admin-definition-col-explanation\s*\{[\s\S]*?width:\s*210px/);
  assert.match(styles, /\.admin-inputs-definitions-table \.admin-definition-col-aliases\s*\{[\s\S]*?width:\s*125px/);
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
  assert.doesNotMatch(page, /availableSeason\.label %> ·/);
  assert.doesNotMatch(readView("admin_results.ejs"), /availableSeason\.label %> ·/);
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
  assert.match(region, /class="admin-race-data-table-toolbar admin-toolbar"/);
  assert.doesNotMatch(region, /admin-race-data-toolbar/);
  assert.doesNotMatch(region, /open_actuals|derived_actuals|derivedActuals/);
  assert.match(region, /data-race-data-result-row/);
  assert.match(region, /data-race-data-edit>Edit data/);
  assert.match(region, /action="\/admin\/race-data\/review"/);
  assert.match(region, /name="returnTo"/);
  assert.match(region, /admin-race-data-review-state/);
  assert.match(region, /admin-race-data-review-button/);
  assert.match(region, /admin-race-data-review-icon/);
  assert.match(region, /data-race-data-review-status/);
  assert.match(region, /toLocaleDateString\('en-GB'/);
  assert.doesNotMatch(region, /hour: '2-digit'|minute: '2-digit'/);
  assert.match(region, /admin_race_data_entity_label/);
  assert.match(region, /round\.code/);
  assert.match(region, /option\.shortLabel/);
  assert.match(region, /id="admin-race-data-metric-select"[^>]*aria-label="Content"/);
  assert.doesNotMatch(region, /<label[^>]*>Content<\/label>/);
  assert.doesNotMatch(region, /admin-race-data-edit-column/);
  assert.match(region, /data-race-data-editor-details/);
  assert.match(region, /data-race-data-edit-input/);
  assert.doesNotMatch(region, /data-race-data-selection-label/);
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
  assert.match(roundRegionStyles[1], /gap:\s*28px/);
  const pageStyles = styles.match(/\.admin-page-card\.admin-race-data-page\s*\{([\s\S]*?)\n\}/);
  assert.ok(pageStyles, "race data page styles should be explicit");
  assert.match(pageStyles[1], /gap:\s*24px/);
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
  assert.match(styles, /\.admin-race-data-review-state\s*\{/);
  assert.match(styles, /\.admin-race-data-review-form\s*\{/);
  assert.match(styles, /\.admin-race-data-review-button\s*\{/);
  assert.match(styles, /\.admin-toolbar-actions\s*>\s*button,[\s\S]*?\.admin-toolbar-actions\s*>\s*form\s*>\s*button/);
  assert.match(styles, /\.admin-race-data-detail-table--result \.admin-race-data-result-cell--driver \.admin-race-data-compact-label/);
  assert.doesNotMatch(styles, /\.admin-race-data-team\s*\{/);
});

test("shared compact geometry covers Inputs team order and Race Data metric select", () => {
  const inputs = readView("admin_inputs.ejs");
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(inputs, /admin-inputs-index-col admin-inputs-driver-col-number/);
  assert.match(inputs, /admin-inputs-index-col admin-inputs-team-col-order/);
  assert.match(styles, /\.admin-inputs-index-col\s*\{[\s\S]*?width:\s*5%/);
  assert.match(styles, /\.admin-inputs-team-table \.admin-inputs-team-col-name\s*\{[\s\S]*?width:\s*35%/);
  assert.match(styles, /\.admin-inputs-team-table \.admin-inputs-team-col-driver\s*\{[\s\S]*?width:\s*30%/);
  assert.match(styles, /\.admin-race-data-metric-select-form select\s*\{[\s\S]*?min-height:\s*32px/);
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
  assert.match(tabs, /partials\/admin_segmented_control/);
  assert.match(tabs, /admin-inputs-tabs admin-race-data-switch/);
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

test("inputs toolbar actions use the shared compact rhythm", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  assert.match(styles, /\.admin-toolbar-actions\s*\{/);
  assert.match(styles, /\.admin-toolbar-actions\s*>\s*button/);
  assert.match(styles, /min-height:\s*30px/);
});

test("inputs navigation and actions reuse the race-data controls", () => {
  const view = readView("admin_inputs.ejs");
  const tabs = readView("partials/admin_inputs_tabs.ejs");
  const raceData = readView("partials/admin_race_data_round_region.ejs");
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");

  assert.match(tabs, /partials\/admin_segmented_control/);
  assert.match(tabs, /admin-inputs-tabs admin-race-data-switch/);
  assert.match(readView("partials/admin_segmented_control.ejs"), /admin-segmented-control__item/);
  assert.match(view, /admin-inputs-toolbar-end admin-toolbar-actions/);
  assert.match(raceData, /admin-race-data-detail-actions admin-toolbar-actions/);
  assert.match(styles, /\.admin-toolbar-actions\s*\{/);
  assert.match(styles, /\.admin-toolbar-actions\s*>\s*button,[\s\S]*?\.admin-toolbar-actions\s*>\s*form\s*>\s*button/);
});

test("shared admin design primitives have one theme-aware contract", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  const segmented = readView("partials/admin_segmented_control.ejs");
  assert.match(styles, /--admin-space-5:\s*24px/);
  assert.match(styles, /--admin-control-height:\s*34px/);
  assert.match(styles, /--admin-table-cell-x:\s*10px/);
  assert.match(styles, /\.admin-shell-heading\s*\{/);
  assert.match(styles, /\.admin-toolbar\s*\{/);
  assert.match(styles, /\.admin-segmented-control\s*\{/);
  assert.match(styles, /\.admin-table-shell\s*\{/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(segmented, /admin-segmented-control__item/);
  assert.match(segmented, /aria-current="page"/);
});

test("input editing keeps team reordering scoped to the selected row", () => {
  const view = readView("admin_inputs.ejs");
  const app = fs.readFileSync(path.join(repoRoot, "public", "app.js"), "utf8");
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");

  assert.match(view, /data-table-capabilities="edit,remove,reorder"/);
  assert.match(view, /class="admin-inputs-team-order"/);
  assert.match(view, /class="admin-inputs-team-position"><%= index \+ 1 %><\/span>/);
  assert.match(view, /<th scope="col"><abbr title="<%= t\('admin_inputs.display_order'\) %>">#<\/abbr><\/th>/);
  assert.match(app, /selectedRow\.classList\.add\('is-editing'\)/);
  assert.match(app, /row\.classList\.remove\('is-editing'\)/);
  assert.match(styles, /\.admin-inputs-team-order \.admin-order-buttons\s*\{[\s\S]*?display:\s*none/);
  assert.match(styles, /\.admin-inputs-team-table \[data-selectable-row\]\.is-editing \.admin-order-buttons\s*\{[\s\S]*?display:\s*inline-flex/);
  assert.match(styles, /\.admin-inputs-team-order-inner\s*\{[\s\S]*?display:\s*inline-flex/);
  assert.match(styles, /\.admin-inputs-team-position\s*\{[\s\S]*?font-variant-numeric:\s*tabular-nums/);
});

test("driver number column stays compact without changing the table identity columns", () => {
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");
  const numberRule = styles.match(/\.admin-inputs-driver-table \.admin-inputs-driver-col-number\s*\{([^}]*)\}/)?.[1] || "";
  assert.match(numberRule, /width:\s*5%/);
  assert.match(styles, /\.admin-inputs-driver-table th:first-child,[\s\S]*?white-space:\s*nowrap/);
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

test("race data shares podium styling with constructor cells and formats damage totals", () => {
  const cell = readView("partials/admin_race_data_matrix_cell.ejs");
  const footer = readView("partials/admin_race_data_matrix_footer.ejs");
  const styles = fs.readFileSync(path.join(repoRoot, "public", "styles.css"), "utf8");

  assert.match(cell, /cell\.podiumPosition \? 'is-podium-'/);
  assert.doesNotMatch(cell, /viewMode === 'drivers'/);
  assert.match(footer, /focusFooter\.totalDisplay/);
  assert.match(styles, /\.admin-race-data-cell\.is-podium-1\s*\{/);
  assert.match(styles, /\.admin-race-data-cell\.is-podium-2\s*\{/);
  assert.match(styles, /\.admin-race-data-cell\.is-podium-3\s*\{/);
});
