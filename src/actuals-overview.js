"use strict";

const {
  actualOverviewViewForQuestion,
  formatActualOverviewValue
} = require("./race-data-review-model");

const OVERVIEW_FOCUS_LABELS = Object.freeze({
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
  dnf_by_race: "DNF by race",
  title_decision: "Title decision",
  all_teams_points: "Constructor points",
  race1_champion: "Race 1 champion",
  engine_top5: "Engine top 5",
  ferrari_podium: "Podiums",
  sprint_champion_same: "Sprint points",
  engine_switch: "Engine switch",
  points: "Points"
});

function normalizeRoundNumber(value) {
  const roundNumber = Number(value);
  return Number.isFinite(roundNumber) && roundNumber > 0
    ? Math.floor(roundNumber)
    : null;
}

function formatActualOverviewLines(raw) {
  if (raw == null || String(raw).trim() === "") return [];
  let value = raw;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    // Snapshot values may be plain strings as well as JSON.
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.trim() !== "");
  }
  return [formatActualOverviewValue(raw)];
}

function compactActualOverviewEntity(value, view) {
  const text = String(value || "").trim();
  if (!text || text === "—") return text;
  if (/^(?:yes|no|more|less|\d+(?:\s+(?:pts?|dnfs?))?)$/i.test(text)) return text;

  const words = text.split(/\s+/).filter(Boolean);
  if (view === "drivers") {
    return words.length > 1 ? words.at(-1) : text;
  }
  if (view === "constructors") {
    if (words.length === 1) return text;
    if (words.length === 2) return `${words[0]} ${words[1][0].toUpperCase()}.`;
    return words
      .map((word) => word.replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase())
      .join("") || text;
  }
  return text;
}

function compactActualOverviewLine(line, view) {
  return String(line || "")
    .split(/,\s*/)
    .map((segment) => segment
      .split(" · ")
      .map((part) => compactActualOverviewEntity(part, view))
      .join(" · "))
    .join(", ");
}

function actualOverviewEntityCode(value, view) {
  const text = String(value || "").trim();
  if (!text) return text;
  const words = text.split(/\s+/).filter(Boolean);
  if (view === "drivers") {
    const name = words.at(-1).replace(/[^A-Za-z0-9]/g, "");
    return name.slice(0, 3).toUpperCase() || text;
  }
  if (view === "constructors") {
    const initials = words
      .map((word) => word.replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase())
      .join("");
    return initials.slice(0, 3) || text;
  }
  return text;
}

function formatActualOverviewDisplayLines(raw, view) {
  const lines = formatActualOverviewLines(raw);
  const compactLines = lines.map((line) => compactActualOverviewLine(line, view));
  const canUseCodes = ["drivers", "constructors"].includes(view)
    && lines.length >= 5
    && lines.every((line) => !line.includes(" · ") && !/\d/.test(line));
  if (!canUseCodes) return { lines: compactLines, mode: "normal" };

  const codes = lines.map((line) => actualOverviewEntityCode(line, view));
  const grouped = [];
  for (let index = 0; index < codes.length; index += 3) {
    grouped.push(codes.slice(index, index + 3).join(" · "));
  }
  return { lines: grouped, mode: "codes" };
}

function actualOverviewFocusLabel(question) {
  const metric = String(question?.race_data_focus?.metric || "").trim().toLowerCase();
  if (OVERVIEW_FOCUS_LABELS[metric]) return OVERVIEW_FOCUS_LABELS[metric];
  const id = String(question?.id || "").trim().toLowerCase();
  if (OVERVIEW_FOCUS_LABELS[id]) return OVERVIEW_FOCUS_LABELS[id];
  if (!metric) return OVERVIEW_FOCUS_LABELS.points;
  return metric
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase()) || "Race Data";
}

function buildActualsOverview({
  season,
  races = [],
  questions = [],
  snapshots = [],
  latestRoundNumber = null,
  publishedActuals = null,
  fetchSnapshotValues = () => ({})
} = {}) {
  const safeSeason = Number(season);
  const snapshotsByRound = new Map();
  const valuesByRound = new Map();

  for (const snapshot of snapshots || []) {
    const roundNumber = normalizeRoundNumber(snapshot?.round_number);
    if (roundNumber == null) continue;
    snapshotsByRound.set(roundNumber, snapshot);
    valuesByRound.set(roundNumber, fetchSnapshotValues(snapshot.id) || {});
  }

  const currentRound = normalizeRoundNumber(latestRoundNumber);
  const publishedRound = normalizeRoundNumber(publishedActuals?.snapshot?.round_number);
  const targets = (races || []).map((raceName, index) => {
    const roundNumber = index + 1;
    const snapshot = snapshotsByRound.get(roundNumber) || null;
    let timing = "future";
    if (currentRound != null) {
      if (roundNumber < currentRound) timing = "past";
      else if (roundNumber === currentRound) timing = "current";
    }
    const displayRaceName = String(raceName || `R${roundNumber}`).trim();
    return {
      key: `round:${roundNumber}`,
      roundNumber,
      raceName: displayRaceName,
      timing,
      snapshotId: snapshot ? Number(snapshot.id) : null,
      reviewStatus: snapshot?.review_status || null,
      reviewedAt: snapshot?.reviewed_at || null,
      updatedAt: snapshot?.updated_at || snapshot?.created_at || null,
      published: publishedRound === roundNumber
    };
  });

  const rows = (questions || []).map((question, index) => {
    const baseView = actualOverviewViewForQuestion(question);
    return {
      question,
      questionNumber: index + 1,
      baseView,
      focusLabel: actualOverviewFocusLabel(question),
      cells: targets.map((target) => {
        const values = valuesByRound.get(target.roundNumber) || {};
        const rawValue = values[question.id];
        const hasValue = rawValue != null && String(rawValue).trim() !== "";
        const display = formatActualOverviewDisplayLines(rawValue, baseView);
        return {
          value: formatActualOverviewValue(rawValue),
          lines: formatActualOverviewLines(rawValue),
          displayLines: display.lines,
          displayMode: display.mode,
          hasValue,
          reviewStatus: target.reviewStatus,
          published: target.published,
          roundNumber: target.roundNumber,
          timing: target.timing,
          href: `/admin/race-data?season=${encodeURIComponent(safeSeason)}&round=${encodeURIComponent(target.roundNumber)}&view=${encodeURIComponent(baseView)}&focus=${encodeURIComponent(question.id)}`
        };
      })
    };
  });

  return {
    targets,
    rows,
    pendingCount: targets.filter((target) => target.reviewStatus === "pending").length,
    reviewedCount: targets.filter((target) => target.reviewStatus === "reviewed").length,
    publishedRound
  };
}

module.exports = { buildActualsOverview };
