"use strict";

const METRIC_DEFINITIONS = [
  {
    id: "points",
    metric: "points",
    matrixMetric: "points",
    labelKey: "admin_race_data.points",
    fallback: "Championship points"
  },
  {
    id: "metric:podiums",
    metric: "podiums",
    matrixMetric: "podiums",
    labelKey: "admin_race_data.focus_podiums",
    fallback: "Podiums"
  },
  {
    id: "metric:dnfs",
    metric: "dnfs",
    matrixMetric: "dnfs",
    labelKey: "admin_race_data.focus_dnfs",
    fallback: "DNFs"
  },
  {
    id: "metric:grid_wins",
    metric: "grid_wins",
    matrixMetric: "grid_wins",
    labelKey: "admin_race_data.focus_grid_wins",
    fallback: "Grid wins"
  },
  {
    id: "metric:driver_of_day",
    metric: "driver_of_day",
    matrixMetric: "driver_of_day",
    labelKey: "admin_race_data.focus_driver_of_day",
    fallback: "Driver of the Day"
  },
  {
    id: "metric:sprint_points",
    metric: "sprint_points",
    matrixMetric: "sprint_points",
    labelKey: "admin_race_data.focus_sprint_points",
    fallback: "Sprint points"
  },
  {
    id: "metric:damage",
    metric: "damage",
    matrixMetric: "damage",
    labelKey: "admin_race_data.focus_damage",
    fallback: "Damage cost"
  }
];

function translatedLabel(t, key, fallback) {
  const value = typeof t === "function" ? t(key) : "";
  return value && value !== key ? value : fallback;
}

function buildRaceDataMetricOptions(t, { pointsLabel = null } = {}) {
  return METRIC_DEFINITIONS.map((definition) => ({
    ...definition,
    view: "all",
    questionId: null,
    questionNumber: null,
    group: "metrics",
    label: definition.id === "points"
      ? pointsLabel || translatedLabel(t, definition.labelKey, definition.fallback)
      : translatedLabel(t, definition.labelKey, definition.fallback)
  }));
}

function formatActualOverviewValue(raw) {
  if (raw == null || String(raw).trim() === "") return "—";
  let value = raw;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    // Snapshot values may be plain strings as well as JSON.
  }
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ") || "—";
  if (value && typeof value === "object") {
    if (value.winner != null && value.diff != null) return `${value.winner} · ${value.diff} pts`;
    if (value.choice != null && value.driver != null) return `${value.choice} · ${value.driver}`;
    if (value.value != null && value.driver != null) {
      const driver = Array.isArray(value.driver) ? value.driver.join(", ") : String(value.driver);
      return `${value.value} · ${driver}`;
    }
    if (value.dnf_by_race && typeof value.dnf_by_race === "object") {
      const total = Object.values(value.dnf_by_race).reduce((sum, item) => sum + Number(item || 0), 0);
      return `${total} DNF${total === 1 ? "" : "s"}`;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function actualOverviewViewForQuestion(question) {
  return question?.race_data_focus?.view === "constructors" ? "constructors" : "drivers";
}

module.exports = {
  METRIC_DEFINITIONS,
  actualOverviewViewForQuestion,
  buildRaceDataMetricOptions,
  formatActualOverviewValue
};
