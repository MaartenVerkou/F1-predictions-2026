"use strict";

const {
  compactQuestionLabel,
  raceDataFocusLabel
} = require("./race-data-focus");

const BASIS_LABELS = Object.freeze({
  drivers: "Drivers",
  teams: "Constructors",
  races: "Races",
  derived: "Derived",
  external: "External"
});

const SNAPSHOT_STATUS_RANK = Object.freeze({
  pending: 3,
  reviewed: 2,
  published: 1
});

function normalizeText(value) {
  return String(value == null ? "" : value).trim();
}

function sourceBasis(question) {
  const source = normalizeText(question?.options_source).toLowerCase();
  if (BASIS_LABELS[source]) return source;

  const focus = question?.race_data_focus || {};
  if (Array.isArray(focus.compareTeams) && focus.compareTeams.length) return "teams";
  if (Array.isArray(focus.compareDrivers) && focus.compareDrivers.length) return "drivers";
  if (focus.view === "constructors") return "teams";
  if (focus.view === "drivers") return "drivers";
  if (
    focus.kind === "unavailable"
    || (focus.requiredEvidence || []).some((item) => normalizeText(item).startsWith("external."))
  ) {
    return "external";
  }
  return "derived";
}

function basisLabel(question) {
  return BASIS_LABELS[sourceBasis(question)] || BASIS_LABELS.derived;
}

function compactPoints(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value} pts`;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value)
      .map(([key, points]) => `${key} ${points}`)
      .join(" · ");
  }
  return "—";
}

function scoringSummary(question) {
  const points = question?._effectivePoints ?? question?.points;
  const summary = compactPoints(points);
  const override = normalizeText(question?._pointsOverrideRaw);
  return {
    label: override ? `Override · ${summary}` : summary,
    detail: normalizeText(question?.points_display) || summary,
    hasOverride: Boolean(override)
  };
}

function evidenceLabel(value) {
  const text = normalizeText(value);
  if (!text) return "";
  if (text.startsWith("external.")) {
    return `External · ${text.slice("external.".length).replace(/[_-]+/g, " ")}`;
  }
  return text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function questionEvidence(question) {
  const evidence = Array.isArray(question?.race_data_focus?.requiredEvidence)
    ? question.race_data_focus.requiredEvidence.map(evidenceLabel).filter(Boolean)
    : [];
  return evidence.length ? evidence.join(" · ") : "Definition";
}

function buildQuestionActualStatusMap({
  snapshots = [],
  publishedSnapshot = null,
  fetchSnapshotValues = () => ({})
} = {}) {
  const map = new Map();
  const publishedId = Number(publishedSnapshot?.id);

  for (const snapshot of snapshots || []) {
    const snapshotId = Number(snapshot?.id);
    if (!Number.isInteger(snapshotId)) continue;
    const roundNumber = Number(snapshot?.round_number);
    const status = snapshotId === publishedId
      ? "published"
      : normalizeText(snapshot?.review_status).toLowerCase() === "pending"
        ? "pending"
        : "reviewed";
    const values = fetchSnapshotValues(snapshotId) || {};
    for (const questionId of Object.keys(values)) {
      const current = map.get(questionId);
      const candidate = {
        status,
        roundNumber: Number.isFinite(roundNumber) ? roundNumber : null,
        snapshotId
      };
      if (
        !current
        || (candidate.roundNumber || 0) > (current.roundNumber || 0)
        || (
          candidate.roundNumber === current.roundNumber
          && SNAPSHOT_STATUS_RANK[candidate.status] > SNAPSHOT_STATUS_RANK[current.status]
        )
      ) {
        map.set(questionId, candidate);
      }
    }
  }
  return map;
}

function buildQuestionContractRows(
  questions = [],
  {
    catalog = null,
    actualStatusByQuestion = new Map(),
    selectedSeason = null,
    raceDataBasePath = "/admin/race-data",
    actualsBasePath = "/admin/actuals"
  } = {}
) {
  const readinessByQuestion = new Map(
    (catalog?.readiness?.checks?.questions || [])
      .map((check) => [String(check.id), check])
  );
  const hasCatalog = Boolean(catalog?.season);

  return (questions || []).map((question, index) => {
    const id = normalizeText(question?.id);
    const focus = question?.race_data_focus || {};
    const check = readinessByQuestion.get(id) || null;
    const hasOptionSource = Boolean(normalizeText(question?.options_source));
    const optionState = !hasOptionSource
      ? "not_applicable"
      : !hasCatalog
        ? "select_season"
        : check?.ready
          ? "ready"
          : "unresolved";
    const lifecycle = actualStatusByQuestion instanceof Map
      ? actualStatusByQuestion.get(id) || null
      : actualStatusByQuestion?.[id] || null;
    const focusView = focus.view === "constructors" ? "constructors" : "drivers";
    const raceDataHref = id && focus.metric
      ? `${raceDataBasePath}?season=${encodeURIComponent(selectedSeason || "")}&view=${encodeURIComponent(focusView)}&focus=${encodeURIComponent(id)}`
      : null;
    const actualsHref = id
      ? `${actualsBasePath}?season=${encodeURIComponent(selectedSeason || "")}#question-${encodeURIComponent(id)}`
      : null;
    const scoring = scoringSummary(question);

    return {
      question,
      id,
      number: index + 1,
      shortLabel: compactQuestionLabel(question, focus.metric),
      typeLabel: normalizeText(question?.type) || "text",
      basis: sourceBasis(question),
      basisLabel: basisLabel(question),
      derivationLabel: focus.metric ? raceDataFocusLabel(question) : "No race projection",
      evidenceLabel: questionEvidence(question),
      scopeLabel: normalizeText(focus.scope).replace(/[_-]+/g, " ") || "—",
      scoringLabel: scoring.label,
      scoringDetail: scoring.detail,
      hasPointsOverride: scoring.hasOverride,
      included: question?._included !== false,
      optionState,
      optionCount: check?.optionCount == null ? null : Number(check.optionCount),
      catalogRevision: catalog?.catalogRevision || null,
      actualStatus: lifecycle?.status || "none",
      actualRoundNumber: lifecycle?.roundNumber || null,
      actualSnapshotId: lifecycle?.snapshotId || null,
      raceDataHref,
      actualsHref,
      orderIndex: Number.isFinite(Number(question?._orderIndex))
        ? Number(question._orderIndex)
        : index
    };
  });
}

module.exports = {
  BASIS_LABELS,
  buildQuestionActualStatusMap,
  buildQuestionContractRows,
  compactPoints,
  questionEvidence,
  scoringSummary,
  sourceBasis
};
