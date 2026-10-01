"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { buildActualsOverview, projectActualsCell } = require("../src/actuals-overview");

test("projects every Actuals answer through one bounded display contract", () => {
  assert.deepEqual(projectActualsCell('"12"', { view: "drivers" }), {
    fullText: "12",
    displayText: "12",
    kind: "scalar",
    overflowCount: 0
  });

  assert.deepEqual(projectActualsCell(
    JSON.stringify({
      value: "2",
      driver: ["George Russell", "Kimi Antonelli", "Kimi Antonelli", "Charles Leclerc"]
    }),
    { view: "drivers" }
  ), {
    fullText: "2 · George Russell, Kimi Antonelli, Charles Leclerc",
    displayText: "2 · RUS · ANT · LEC",
    kind: "entities",
    overflowCount: 0
  });

  assert.deepEqual(projectActualsCell(JSON.stringify([
    "George Russell",
    "Kimi Antonelli",
    "Charles Leclerc",
    "Lewis Hamilton",
    "Oscar Piastri",
    "Lando Norris",
    "Max Verstappen",
    "Fernando Alonso"
  ]), { view: "drivers" }), {
    fullText: "George Russell, Kimi Antonelli, Charles Leclerc, Lewis Hamilton, Oscar Piastri, Lando Norris, Max Verstappen, Fernando Alonso",
    displayText: "RUS · ANT · LEC · HAM · PIA · +2",
    kind: "entities",
    overflowCount: 2
  });

  const fallback = projectActualsCell(JSON.stringify({ unknown: "value" }), { view: "drivers" });
  assert.equal(fallback.kind, "scalar");
  assert.equal(fallback.fullText, '{"unknown":"value"}');
  assert.equal(fallback.displayText, fallback.fullText);
});

test("builds one season overview from the latest persisted snapshot per round", () => {
  const overview = buildActualsOverview({
    season: 2026,
    races: ["Australian Grand Prix", "Chinese Grand Prix", "Japanese Grand Prix"],
    questions: [
      { id: "drivers_championship_top_3", prompt: "Who leads?", race_data_focus: { view: "drivers", metric: "points" } },
      { id: "team_question", prompt: "Which team?", race_data_focus: { view: "constructors", metric: "dnfs" } },
      { id: "podium_question", prompt: "Who reached the podium?", race_data_focus: { view: "drivers", metric: "podiums" } },
      {
        id: "select_three_races_dnfs",
        prompt: "Select 3 races. Earn 2 points per DNF in those races.",
        type: "multi_select_limited",
        count: 3,
        race_data_focus: { view: "drivers", metric: "dnf_by_race" }
      }
    ],
    snapshots: [
      { id: 101, round_number: 1, review_status: "reviewed", updated_at: "2026-03-10T00:00:00Z" },
      { id: 102, round_number: 2, review_status: "pending", updated_at: "2026-03-20T00:00:00Z" }
    ],
    latestRoundNumber: 2,
    publishedActuals: { available: true, snapshot: { round_number: 1 } },
    fetchSnapshotValues: (snapshotId) => snapshotId === 101
      ? {
        drivers_championship_top_3: '["Antonelli","Russell","Leclerc"]',
        team_question: '["Aston Martin","Red Bull Racing","Haas F1 Team"]',
        podium_question: '["George Russell","Kimi Antonelli","Charles Leclerc","Lewis Hamilton","Oscar Piastri","Lando Norris"]',
        select_three_races_dnfs: JSON.stringify({ dnf_by_race: { R1: 2, R2: 1, R3: 4, R4: 3 } })
      }
      : { team_question: '"Mercedes"' }
  });

  assert.deepEqual(overview.targets.map((target) => target.timing), ["past", "current", "future"]);
  assert.deepEqual(overview.targets.map((target) => target.reviewStatus), ["reviewed", "pending", null]);
  assert.deepEqual(overview.targets.map((target) => target.published), [true, false, false]);
  assert.deepEqual(overview.targets.map((target) => target.raceName), ["Australian Grand Prix", "Chinese Grand Prix", "Japanese Grand Prix"]);
  assert.deepEqual(overview.targets.map((target) => target.raceCode), ["AUS", "CHN", "JPN"]);
  assert.equal(overview.pendingCount, 1);
  assert.equal(overview.publishedRound, 1);
  assert.equal(overview.rows[0].cells[0].value, "Antonelli, Russell, Leclerc");
  assert.equal(overview.rows[0].cells[0].displayText, "ANT · RUS · LEC");
  assert.equal(overview.rows[0].focusLabel, "Points");
  assert.equal(overview.rows[1].focusLabel, "DNF");
  assert.equal(overview.rows[1].cells[0].displayText, "ASM · RBR · HFT");
  assert.equal(overview.rows[2].focusLabel, "Podiums");
  assert.equal(overview.rows[2].cells[0].kind, "entities");
  assert.equal(overview.rows[2].cells[0].displayText, "RUS · ANT · LEC · HAM · PIA · NOR");
  assert.equal(overview.rows[3].cells[0].value, "9 DNFs");
  assert.equal(overview.rows[3].cells[0].displayText, "9 DNFs");
  assert.equal(overview.rows[3].focusLabel, "Top 3 DNF races");
  assert.match(overview.rows[0].cells[0].href, /round=1/);
  assert.match(overview.rows[0].cells[0].href, /view=drivers/);
  assert.match(overview.rows[1].cells[0].href, /view=constructors/);
  assert.equal(overview.rows[0].cells[2].hasValue, false);
});

test("compacts structured driver answers without repeating tied winners", () => {
  const overview = buildActualsOverview({
    season: 2026,
    races: ["Australian Grand Prix"],
    questions: [{
      id: "lowest_grid_win_position",
      prompt: "Lowest starting position from which a race is won (and who wins)",
      type: "single_choice_with_driver",
      race_data_focus: { view: "drivers", metric: "grid_wins" }
    }],
    snapshots: [{ id: 1, round_number: 1, review_status: "pending" }],
    latestRoundNumber: 1,
    fetchSnapshotValues: () => ({
      lowest_grid_win_position: JSON.stringify({
        value: "2",
        driver: ["George Russell", "Kimi Antonelli", "Kimi Antonelli", "Charles Leclerc"]
      })
    })
  });

  assert.equal(overview.rows[0].cells[0].displayText, "2 · RUS · ANT · LEC");
  assert.equal(overview.rows[0].cells[0].kind, "entities");
  assert.equal(overview.rows[0].cells[0].value, "2 · George Russell, Kimi Antonelli, Charles Leclerc");
});

test("uses one bounded code projection for long entity lists", () => {
  const overview = buildActualsOverview({
    season: 2026,
    races: ["Australian Grand Prix"],
    questions: [
      {
        id: "long_driver_list",
        prompt: "Which drivers?",
        race_data_focus: { view: "drivers", metric: "podiums" }
      },
      {
        id: "long_constructor_list",
        prompt: "Which teams?",
        race_data_focus: { view: "constructors", metric: "qualifying" }
      }
    ],
    snapshots: [{ id: 1, round_number: 1, review_status: "pending" }],
    latestRoundNumber: 1,
    fetchSnapshotValues: () => ({
      long_driver_list: JSON.stringify([
        "George Russell",
        "Kimi Antonelli",
        "Charles Leclerc",
        "Lewis Hamilton",
        "Oscar Piastri",
        "Lando Norris",
        "Max Verstappen",
        "Fernando Alonso"
      ]),
      long_constructor_list: JSON.stringify([
        "Alpine",
        "Audi",
        "Cadillac",
        "Ferrari",
        "Haas F1 Team",
        "McLaren",
        "Mercedes",
        "Racing Bulls"
      ])
    })
  });

  assert.equal(overview.rows[0].cells[0].displayText, "RUS · ANT · LEC · HAM · PIA · +2");
  assert.equal(overview.rows[1].cells[0].displayText, "ALP · AUD · CAD · FER · HFT · +2");
  assert.equal(overview.rows[0].cells[0].kind, "entities");
  assert.equal(overview.rows[1].cells[0].kind, "entities");
  assert.equal(overview.rows[0].cells[0].overflowCount, 2);
  assert.equal(overview.rows[1].cells[0].overflowCount, 2);
});
