"use strict";

const {
  actualOverviewViewForQuestion,
  formatActualOverviewValue
} = require("./race-data-review-model");
const { compactQuestionLabel, raceDataFocusLabel } = require("./race-data-focus");

// Actuals is a wide, scan-first table. Keep multi-entity answers readable
// without allowing one answer to set an unbounded row height. The full value
// remains available in the cell's title/aria-label; this is only its compact
// visual projection.
const ACTUALS_OVERVIEW_MAX_LINES = 2;
const ACTUALS_OVERVIEW_MAX_VISIBLE_ITEMS = ACTUALS_OVERVIEW_MAX_LINES * 3;

// Keep the overview compact without making the visible race labels ambiguous.
// These are the familiar three-letter F1 calendar codes; the fallback below
// keeps the formatter useful for future calendars that are not in this list.
const ACTUALS_RACE_CODE_ALIASES = Object.freeze([
  ["australian", "AUS"],
  ["chinese", "CHN"],
  ["japanese", "JPN"],
  ["miami", "MIA"],
  ["canadian", "CAN"],
  ["monaco", "MON"],
  ["barcelona", "BCN"],
  ["austrian", "AUT"],
  ["british", "GBR"],
  ["belgian", "BEL"],
  ["hungarian", "HUN"],
  ["dutch", "NED"],
  ["italian", "ITA"],
  ["spanish", "ESP"],
  ["azerbaijan", "AZE"],
  ["singapore", "SIN"],
  ["united states", "USA"],
  ["mexico city", "MEX"],
  ["mexico", "MEX"],
  ["sao paulo", "SAO"],
  ["las vegas", "LAS"],
  ["qatar", "QAT"],
  ["abu dhabi", "ABU"]
]);

function actualOverviewRaceCode(value) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!normalized) return "—";

  const alias = ACTUALS_RACE_CODE_ALIASES.find(([name]) => normalized.startsWith(name));
  if (alias) return alias[1];

  const words = normalized.split(/\s+/).filter((word) => !["grand", "prix", "gp"].includes(word));
  if (!words.length) return "—";
  if (words.length > 1) {
    const initials = words.map((word) => word.charAt(0)).join("");
    if (initials.length >= 3) return initials.slice(0, 3).toUpperCase();
    return `${words[0].charAt(0)}${words[1].slice(0, 2)}`.toUpperCase();
  }
  return words[0].slice(0, 3).toUpperCase() || "—";
}

function normalizeRoundNumber(value) {
  const roundNumber = Number(value);
  return Number.isFinite(roundNumber) && roundNumber > 0
    ? Math.floor(roundNumber)
    : null;
}

function parseActualOverviewRaw(raw) {
  let value = raw;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    // Snapshot values may be plain strings as well as JSON.
  }
  return value;
}

function limitedDnfOverviewValue(raw, question) {
  if (question?.type !== "multi_select_limited" || question?.race_data_focus?.metric !== "dnf_by_race") {
    return null;
  }
  const value = parseActualOverviewRaw(raw);
  if (!value || typeof value !== "object" || !value.dnf_by_race || typeof value.dnf_by_race !== "object") {
    return null;
  }
  const limit = Math.max(1, Math.floor(Number(question.count) || 3));
  const total = Object.entries(value.dnf_by_race)
    .map(([race, count]) => ({ race, count: Number(count) }))
    .filter(({ count }) => Number.isFinite(count) && count >= 0)
    .sort((left, right) => right.count - left.count || left.race.localeCompare(right.race))
    .slice(0, limit)
    .reduce((sum, item) => sum + item.count, 0);
  return `${total} DNF${total === 1 ? "" : "s"}`;
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

function uniqueActualOverviewEntities(values) {
  return Array.from(new Set((values || [])
    .map((value) => value == null ? "" : String(value).trim())
    .filter((value) => value && value !== "—")));
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
    const cleanedWords = words
      .map((word) => word.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
      .filter(Boolean);
    const initials = cleanedWords.map((word) => word.charAt(0)).join("");
    if (initials.length >= 3) return initials.slice(0, 3);
    if (cleanedWords.length > 1) return `${cleanedWords[0].slice(0, 2)}${cleanedWords[1].charAt(0)}`.slice(0, 3);
    return cleanedWords[0]?.slice(0, 3) || text;
  }
  return text;
}

function projectActualOverviewEntities(values, view, prefix = "") {
  const names = uniqueActualOverviewEntities(values);
  if (!names.length) {
    const text = prefix.trim() || "—";
    return { fullText: text, displayText: text, kind: "scalar", overflowCount: 0 };
  }

  const compactNames = names.map((name) => compactActualOverviewEntity(name, view));
  const fullText = `${prefix}${names.join(", ")}`.trim() || "—";
  if (names.length <= 2) {
    return {
      fullText,
      displayText: `${prefix}${compactNames.join(", ")}`.trim() || "—",
      kind: "entities",
      overflowCount: 0
    };
  }

  const codes = names.map((name) => actualOverviewEntityCode(name, view));
  const overflow = Math.max(0, codes.length - ACTUALS_OVERVIEW_MAX_VISIBLE_ITEMS);
  const visibleCodes = overflow
    ? codes.slice(0, ACTUALS_OVERVIEW_MAX_VISIBLE_ITEMS - 1)
    : codes;
  const tokens = overflow ? [...visibleCodes, `+${overflow}`] : visibleCodes;
  return {
    fullText,
    displayText: `${prefix}${tokens.join(" · ")}`.trim() || "—",
    kind: "entities",
    overflowCount: overflow
  };
}

function projectActualsCell(raw, { view = "drivers", question = null } = {}) {
  const limited = limitedDnfOverviewValue(raw, question);
  if (limited) {
    return { fullText: limited, displayText: limited, kind: "scalar", overflowCount: 0 };
  }

  if (raw == null || String(raw).trim() === "") {
    return { fullText: "—", displayText: "—", kind: "scalar", overflowCount: 0 };
  }

  const parsed = parseActualOverviewRaw(raw);
  if (Array.isArray(parsed) && ["drivers", "constructors"].includes(view)) {
    return projectActualOverviewEntities(parsed, view);
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray(parsed.driver)) {
    const prefix = parsed.value == null ? "" : `${String(parsed.value)} · `;
    return projectActualOverviewEntities(parsed.driver, view, prefix);
  }

  const fullText = formatActualOverviewValue(raw);
  return {
    fullText,
    displayText: fullText,
    kind: "scalar",
    overflowCount: 0
  };
}

function actualOverviewFocusLabel(question) {
  return raceDataFocusLabel(question);
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
      raceCode: actualOverviewRaceCode(displayRaceName),
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
      shortPrompt: compactQuestionLabel(question, question?.race_data_focus?.metric),
      baseView,
      focusLabel: actualOverviewFocusLabel(question),
      cells: targets.map((target) => {
        const values = valuesByRound.get(target.roundNumber) || {};
        const rawValue = values[question.id];
        const hasValue = rawValue != null && String(rawValue).trim() !== "";
        const projection = projectActualsCell(rawValue, { view: baseView, question });
        return {
          value: projection.fullText,
          displayText: projection.displayText,
          kind: projection.kind,
          overflowCount: projection.overflowCount,
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

module.exports = { buildActualsOverview, projectActualsCell };
