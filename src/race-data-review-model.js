"use strict";

const METRIC_DEFINITIONS = [
  {
    id: "points",
    metric: "points",
    matrixMetric: "points",
    labelKey: "admin_race_data.championship_points_results",
    fallback: "Championship points results"
  },
  {
    id: "championship_points_results",
    metric: "championship_points_results",
    matrixMetric: "championship_points_results",
    labelKey: "admin_race_data.points",
    fallback: "Points"
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

// Keep the canonical race-result facts in one review-oriented order. The
// detail table and its tests consume this registry instead of each inventing
// a column sequence. Session columns are added by buildRaceResultColumns when
// the selected evidence actually contains those sessions.
const RACE_RESULT_COLUMNS = [
  { id: "finish", label: "Pos.", title: "Grand Prix finish position" },
  { id: "driver", labelKey: "admin_race_data.driver", fallback: "Driver" },
  { id: "constructor", labelKey: "admin_race_data.constructor", fallback: "Constructor" },
  { id: "qualifying", labelKey: "admin_race_data.qualifying_short", fallback: "Qualifying" },
  { id: "grid", labelKey: "admin_race_data.grid", fallback: "Grid" },
  { id: "status", labelKey: "admin_race_data.status", fallback: "Status" },
  { id: "points", labelKey: "admin_race_data.points_short", fallback: "Points" }
];

const SESSION_COLUMN_DEFINITIONS = [
  { id: "practice1", sessionKey: "practice1", label: "P1", title: "Practice 1" },
  { id: "practice2", sessionKey: "practice2", label: "P2", title: "Practice 2" },
  { id: "practice3", sessionKey: "practice3", label: "P3", title: "Practice 3" },
  { id: "sprintQualifying", sessionKey: "sprintQualifying", label: "Sprint Q", title: "Sprint qualifying" },
  { id: "sprint", sessionKey: "sprint", label: "Sprint", title: "Sprint race" },
  { id: "qualifying", sessionKey: "qualifying", label: "Qualifying", title: "Grand Prix qualifying" }
];

const SESSION_ALIASES = {
  practice1: ["practice1", "practice_1", "p1"],
  practice2: ["practice2", "practice_2", "p2"],
  practice3: ["practice3", "practice_3", "p3"],
  sprintQualifying: ["sprintQualifying", "sprint_qualifying", "sprint-qualifying"],
  sprint: ["sprint"],
  qualifying: ["qualifying"]
};

function extractSessionRows(section) {
  if (Array.isArray(section)) return section;
  if (!section || typeof section !== "object") return [];
  for (const key of ["rows", "results", "Results", "QualifyingResults", "SprintResults"]) {
    if (Array.isArray(section[key])) return section[key];
  }
  return [];
}

function getRaceSessionRows(payload, sessionKey) {
  const aliases = SESSION_ALIASES[sessionKey] || [sessionKey];
  const canonicalSessions = payload?.sessions;
  if (canonicalSessions && typeof canonicalSessions === "object") {
    for (const alias of aliases) {
      const canonicalRows = extractSessionRows(canonicalSessions[alias]);
      if (canonicalRows.length) return canonicalRows;
    }
  }
  for (const alias of aliases) {
    const direct = extractSessionRows(payload?.[alias]);
    if (direct.length) return direct;
  }
  const practice = payload?.practice;
  if (practice && !Array.isArray(practice) && typeof practice === "object") {
    for (const alias of aliases) {
      const nested = extractSessionRows(practice[alias]);
      if (nested.length) return nested;
    }
  }
  if (Array.isArray(practice)) {
    const matching = practice.find((session) => {
      const type = String(session?.sessionKey || session?.session_type || session?.type || session?.name || "")
        .replace(/[\s_-]+/g, "")
        .toLowerCase();
      return aliases.some((alias) => type === alias.replace(/[\s_-]+/g, "").toLowerCase());
    });
    const rows = extractSessionRows(matching);
    if (rows.length) return rows;
  }
  return [];
}

function buildRaceResultColumns({ payload = {}, t } = {}) {
  const label = (definition) => definition.label || translatedLabel(t, definition.labelKey, definition.fallback);
  const identity = RACE_RESULT_COLUMNS.slice(0, 3).map((definition) => ({
    ...definition,
    label: label(definition),
    title: definition.title || label(definition)
  }));
  const sessions = SESSION_COLUMN_DEFINITIONS
    .filter((definition) => getRaceSessionRows(payload, definition.sessionKey).length > 0)
    .map((definition) => ({ ...definition }));
  const facts = RACE_RESULT_COLUMNS
    .filter((definition) => !["finish", "driver", "constructor", "qualifying"].includes(definition.id))
    .map((definition) => ({
      ...definition,
      label: label(definition),
      title: definition.title || label(definition)
    }));
  const qualifying = getRaceSessionRows(payload, "qualifying").length
    ? [{ ...SESSION_COLUMN_DEFINITIONS.find((definition) => definition.id === "qualifying") }]
    : [];
  return [...identity, ...sessions.filter((column) => column.id !== "qualifying"), ...qualifying, ...facts];
}

function formatRaceFinishLabel(position) {
  const numericPosition = Number(position);
  if (!Number.isFinite(numericPosition) || numericPosition < 1) return "—";
  return String(numericPosition);
}

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
  RACE_RESULT_COLUMNS,
  SESSION_COLUMN_DEFINITIONS,
  actualOverviewViewForQuestion,
  buildRaceResultColumns,
  buildRaceDataMetricOptions,
  formatActualOverviewValue,
  formatRaceFinishLabel,
  getRaceSessionRows
};
