"use strict";

// Keep the compact focus wording in one place so Actuals and Race Data use
// the same vocabulary for the same derived metric.
const RACE_DATA_FOCUS_LABELS = Object.freeze({
  championship_top3: "Top 3",
  last_standing: "Championship last",
  grid_wins: "Lowest-grid win",
  podiums: "Podiums",
  no_podium_points: "Points without podium",
  driver_of_day: "Driver of the Day",
  dnfs: "DNF",
  damage: "Destructors",
  teammate_points: "Teammate points",
  qualifying_h2h: "Qualifying",
  alpine_comparison: "Team comparison",
  dnf_by_race: "Top 3 DNF races",
  title_decision: "Title decision",
  all_teams_points: "Constructor points",
  race1_champion: "Race 1 champion",
  engine_top5: "Engine top 5",
  ferrari_podium: "Podiums",
  sprint_champion_same: "Sprint points",
  engine_switch: "Engine switch",
  points: "Points"
});

// One compact question vocabulary is shared by Race Data and Actuals. The
// full prompt remains the canonical question text; these labels are only a
// concise presentation aid for narrow controls and table columns.
const COMPACT_QUESTION_LABELS = Object.freeze({
  championship_top3: "Championship top 3",
  constructors_championship_top_3: "Championship top 3",
  drivers_championship_top_3: "Championship top 3",
  last_standing: "Championship last",
  drivers_championship_last: "Championship last",
  grid_wins: "Lowest-grid winners",
  lowest_grid_win_position: "Lowest-grid win",
  podiums: "Podium finishers",
  all_podium_finishers: "Podium finishers",
  no_podium_points: "Points without podium",
  most_points_no_podium: "Points without podium",
  driver_of_day: "Driver of the Day",
  most_driver_of_the_day: "Driver of the Day",
  dnf_by_race: "Three races · most DNFs",
  dnfs: "Most DNFs",
  most_dnfs_driver: "Most DNFs",
  most_dnfs_constructor: "Most DNFs",
  sprint_points: "Sprint points",
  teammate_points: "Teammate points",
  qualifying_h2h: "Qualifying head-to-head",
  closest_qualifying_teammates: "Closest qualifying",
  alpine_comparison: "Team comparison",
  damage: "Destructors Championship",
  destructors_driver: "Destructors Championship",
  destructors_team: "Destructors Championship",
  engine_switch: "Power-unit changes",
  all_teams_points: "Constructor points"
});

function raceDataFocusLabel(questionOrFocus = {}) {
  const metric = String(
    questionOrFocus?.race_data_focus?.metric || questionOrFocus?.metric || ""
  ).trim().toLowerCase();
  if (RACE_DATA_FOCUS_LABELS[metric]) return RACE_DATA_FOCUS_LABELS[metric];

  const id = String(
    questionOrFocus?.id || questionOrFocus?.questionId || ""
  ).trim().toLowerCase();
  if (RACE_DATA_FOCUS_LABELS[id]) return RACE_DATA_FOCUS_LABELS[id];
  if (!metric) return RACE_DATA_FOCUS_LABELS.points;

  return metric
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase()) || "Race Data";
}

function compactQuestionLabel(question, metric) {
  const id = String(question?.id || "").trim();
  const mapped = COMPACT_QUESTION_LABELS[id] || COMPACT_QUESTION_LABELS[String(metric || "").trim().toLowerCase()];
  if (mapped) return mapped;
  const prompt = String(question?.prompt || id || "Question").trim();
  return prompt.length > 42 ? `${prompt.slice(0, 39).trimEnd()}…` : prompt;
}

module.exports = { COMPACT_QUESTION_LABELS, RACE_DATA_FOCUS_LABELS, compactQuestionLabel, raceDataFocusLabel };
