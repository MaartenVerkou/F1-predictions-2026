"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildQuestionInputRows,
  normalizeQuestionInputEdits,
  scoringSummary
} = require("../src/question-admin-model");
const { registerAdminRoutes } = require("../src/routes/admin");

test("question input rows expose only input-adjacent fields", () => {
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
    _orderIndex: 3,
    _basePoints: { "1st": 50, "2nd": 25, "3rd": 15 },
    _pointsOverrideRaw: "10",
    _promptOverrideRaw: "Who has the most retirements?"
  };

  const rows = buildQuestionInputRows([question]);

  assert.equal(rows[0].basisLabel, "Drivers");
  assert.equal(rows[0].derivationLabel, "DNF");
  assert.equal(rows[0].calculationLabel, "Drivers · DNF");
  assert.equal(rows[0].evidenceLabel, "Race classifications");
  assert.equal(rows[0].promptOverride, "Who has the most retirements?");
  assert.equal(rows[0].pointsOverride, "10");
  assert.equal(rows[0].pointsCurrentLabel, "10 pts");
  assert.equal(rows[0].pointsDefaultLabel, "1st 50 · 2nd 25 · 3rd 15");
  assert.equal(rows[0].orderIndex, 3);
  assert.equal(rows[0].derivationMeta, "Calculation basis: Race classifications");
  assert.equal(rows[0].pointsInputPlaceholder, '{"1st":50,"2nd":25,"3rd":15}');
  assert.equal(rows[0].pointsInputType, "text");
});

test("question evidence names the actual standings source when no explicit list exists", () => {
  const rows = buildQuestionInputRows([
    { id: "drivers", race_data_focus: { view: "drivers", metric: "championship_top3" } },
    { id: "constructors", race_data_focus: { view: "constructors", metric: "championship_top3" } }
  ]);

  assert.equal(rows[0].evidenceLabel, "Driver championship points");
  assert.equal(rows[0].calculationLabel, "Drivers · Top 3");
  assert.equal(rows[0].derivationMeta, "Calculation basis: Driver championship points");
  assert.equal(rows[1].evidenceLabel, "Constructor championship points");
  assert.equal(rows[1].calculationLabel, "Constructors · Top 3");
  assert.equal(rows[1].derivationMeta, "Calculation basis: Constructor championship points");
});

test("question input edits normalize order and preserve stable question IDs", () => {
  const questions = [
    { id: "first", _basePoints: 10 },
    { id: "second", _basePoints: 5 }
  ];
  const edits = normalizeQuestionInputEdits(questions, {
    first__order: "2",
    first__prompt: "Second wording",
    first__points: "10",
    first__included: "1",
    second__order: "1",
    second__prompt: "First wording",
    second__points: "5"
  });
  assert.deepEqual(edits.map((row) => row.questionId), ["second", "first"]);
  assert.deepEqual(edits.map((row) => row.orderIndex), [0, 1]);
  assert.equal(edits[1].promptOverride, "Second wording");
  assert.equal(edits[0].included, false);
});

test("question input edits reject duplicate order and empty prompts", () => {
  const questions = [{ id: "first" }, { id: "second" }];
  assert.throws(
    () => normalizeQuestionInputEdits(questions, {
      first__order: "1",
      first__prompt: "First",
      second__order: "1",
      second__prompt: "Second"
    }),
    /already used/
  );
  assert.throws(
    () => normalizeQuestionInputEdits(questions, {
      first__order: "1",
      first__prompt: "",
      second__order: "2",
      second__prompt: "Second"
    }),
    /cannot be empty/
  );
});

test("question input edits accept structured scoring fields without raw JSON", () => {
  const questions = [{
    id: "top_three",
    _basePoints: { "1st": 50, "2nd": 25, "3rd": 15 }
  }];
  const edits = normalizeQuestionInputEdits(questions, {
    top_three__order: "1",
    top_three__prompt: "Pick the top three",
    top_three__points__1st: "60",
    top_three__points__2nd: "30",
    top_three__points__3rd: "20"
  });
  assert.deepEqual(edits[0].pointsOverride, { "1st": 60, "2nd": 30, "3rd": 20 });
  assert.throws(
    () => normalizeQuestionInputEdits(questions, {
      top_three__order: "1",
      top_three__prompt: "Pick the top three",
      top_three__points__1st: "60",
      top_three__points__2nd: ""
    }),
    /complete every scoring field/
  );
});

test("scoring summary is compact while retaining the detailed rule", () => {
  const summary = scoringSummary({
    points: { "1st": 50, "2nd": 25, "3rd": 15 },
    points_display: "1st place = 50 pts, 2nd place = 25 pts, 3rd place = 15 pts"
  });
  assert.equal(summary.label, "1st 50 · 2nd 25 · 3rd 15");
  assert.equal(summary.detail, "1st place = 50 pts, 2nd place = 25 pts, 3rd place = 15 pts");
});

test("Questions route renders the selected season input table and edit mode", () => {
  const db = {
    prepare() {
      return {
        all() { return []; },
        get() { return { count: 0 }; }
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
    { query: { season: "2099", mode: "edit" }, user: { id: 7 } },
    {
      locals: { locale: "en" },
      render(view, model) { rendered = { view, model }; }
    }
  );

  assert.equal(rendered.view, "admin_questions");
  assert.equal(rendered.model.mode, "edit");
  assert.equal(rendered.model.season, 2099);
  assert.equal(rendered.model.workspaceView, "questions");
  assert.equal(rendered.model.questionRows[0].prompt, "Select three races with the most DNFs");
});

test("Questions edit save persists prompt, points, inclusion and order together", () => {
  const writes = [];
  const questions = [
    { id: "first", prompt: "First", type: "single_choice", points: 10, _included: true, _basePoints: 10 },
    { id: "second", prompt: "Second", type: "single_choice", points: 5, _included: true, _basePoints: 5 }
  ];
  const db = {
    prepare() {
      return {
        all() { return []; },
        get() { return { count: 0 }; },
        run(...args) { writes.push(args); return { changes: 1 }; }
      };
    },
    transaction(fn) { return () => fn(); }
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
    getQuestions: () => questions,
    getRaces: () => [],
    logEvent() {}
  });

  let redirected;
  routes["POST /admin/questions"](
    {
      body: {
        first__order: "2",
        first__prompt: "Rewritten first",
        first__points: "12",
        first__included: "1",
        second__order: "1",
        second__prompt: "Rewritten second",
        second__points: "5"
      },
      user: { id: 7 }
    },
    { redirect(path) { redirected = path; } }
  );

  assert.match(redirected, /Questions%20updated/);
  assert.deepEqual(writes.map((args) => args.slice(0, 6)), [
    [2026, "second", 0, "5", 0, "Rewritten second"],
    [2026, "first", 1, "12", 1, "Rewritten first"]
  ]);
});
