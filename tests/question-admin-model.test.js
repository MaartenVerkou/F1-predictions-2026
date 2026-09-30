"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildQuestionActualStatusMap,
  buildQuestionContractRows,
  scoringSummary
} = require("../src/question-admin-model");
const { registerAdminRoutes } = require("../src/routes/admin");

test("question contract rows expose catalog basis, derivation and stable links", () => {
  const question = {
    id: "most_dnfs_driver",
    prompt: "Which driver has the most DNFs?",
    type: "single_choice",
    options_source: "drivers",
    points: 10,
    race_data_focus: {
      view: "drivers",
      metric: "dnfs",
      requiredEvidence: ["race"],
      scope: "season"
    },
    _included: true,
    _orderIndex: 3
  };
  const rows = buildQuestionContractRows([question], {
    selectedSeason: 2026,
    catalog: {
      season: { year: 2026 },
      catalogRevision: "catalog-1",
      readiness: {
        checks: {
          questions: [{ id: question.id, source: "drivers", optionCount: 22, ready: true }]
        }
      }
    }
  });

  assert.equal(rows[0].basisLabel, "Drivers");
  assert.equal(rows[0].derivationLabel, "DNF");
  assert.equal(rows[0].evidenceLabel, "Race");
  assert.equal(rows[0].optionState, "ready");
  assert.equal(rows[0].optionCount, 22);
  assert.match(rows[0].raceDataHref, /focus=most_dnfs_driver/);
  assert.match(rows[0].actualsHref, /#question-most_dnfs_driver$/);
});

test("question contract rows never fall back to another season when options are unresolved", () => {
  const rows = buildQuestionContractRows([{
    id: "select_three_races_dnfs",
    type: "multi_select_limited",
    options_source: "races",
    race_data_focus: { view: "drivers", metric: "dnf_by_race" }
  }], {
    selectedSeason: 2027,
    catalog: {
      season: { year: 2027 },
      readiness: { checks: { questions: [{ id: "select_three_races_dnfs", source: "races", optionCount: 0, ready: false }] } }
    }
  });
  assert.equal(rows[0].optionState, "unresolved");
  assert.equal(rows[0].optionCount, 0);
});

test("question actual status prefers the latest round and keeps pending revisions visible", () => {
  const status = buildQuestionActualStatusMap({
    snapshots: [
      { id: 1, round_number: 4, review_status: "reviewed" },
      { id: 2, round_number: 5, review_status: "pending" }
    ],
    publishedSnapshot: { id: 1 },
    fetchSnapshotValues: (id) => ({ points: JSON.stringify(id) })
  });
  assert.deepEqual(status.get("points"), {
    status: "pending",
    roundNumber: 5,
    snapshotId: 2
  });
});

test("scoring summary is compact while retaining the detailed rule", () => {
  const summary = scoringSummary({
    points: { "1st": 50, "2nd": 25, "3rd": 15 },
    points_display: "1st place = 50 pts, 2nd place = 25 pts, 3rd place = 15 pts"
  });
  assert.equal(summary.label, "1st 50 · 2nd 25 · 3rd 15");
  assert.equal(summary.detail, "1st place = 50 pts, 2nd place = 25 pts, 3rd place = 15 pts");
});

test("Questions route preserves the selected mode and exposes a safe unresolved state", () => {
  const seasons = [{
    id: 1,
    year: 2026,
    label: "2026 active",
    status: "active",
    created_at: "now",
    updated_at: "now"
  }];
  const db = {
    prepare(sql) {
      return {
        all() {
          if (/FROM seasons/i.test(sql)) return seasons;
          return [];
        },
        get() {
          return { count: 0 };
        }
      };
    }
  };
  const routes = {};
  const app = {
    get(pathname, ...handlers) { routes[`GET ${pathname}`] = handlers.at(-1); },
    post(pathname, ...handlers) { routes[`POST ${pathname}`] = handlers.at(-1); }
  };
  registerAdminRoutes(app, {
    db,
    requireAdmin: () => {},
    getCurrentUser: () => ({ id: 7 }),
    getQuestions: () => [{
      id: "select_three_races_dnfs",
      prompt: "Select three races with the most DNFs",
      type: "multi_select_limited",
      options_source: "races",
      race_data_focus: { view: "drivers", metric: "dnf_by_race" },
      _included: true
    }],
    getRaces: () => []
  });

  let rendered;
  routes["GET /admin/questions"](
    { query: { season: "2099", mode: "order" }, user: { id: 7 } },
    {
      locals: { locale: "en" },
      render(view, model) { rendered = { view, model }; }
    }
  );

  assert.equal(rendered.view, "admin_questions");
  assert.equal(rendered.model.mode, "order");
  assert.equal(rendered.model.questionRows[0].optionState, "select_season");
  assert.match(rendered.model.questionRows[0].actualsHref, /season=2099/);
});
