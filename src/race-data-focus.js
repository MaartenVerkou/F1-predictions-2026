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

module.exports = { RACE_DATA_FOCUS_LABELS, raceDataFocusLabel };
