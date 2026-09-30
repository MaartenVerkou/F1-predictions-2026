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
    currentLabel: summary,
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

function pointsInputPlaceholder(question) {
  const points = question?._basePoints ?? question?.points;
  if (typeof points === "number" && Number.isFinite(points)) return String(points);
  if (points && typeof points === "object" && !Array.isArray(points)) {
    return JSON.stringify(points);
  }
  return "";
}

function numericPointsFields(question) {
  const defaults = question?._basePoints ?? question?.points;
  if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) return [];
  const entries = Object.entries(defaults);
  if (!entries.length || entries.some(([, value]) => typeof value !== "number" || !Number.isFinite(value))) {
    return [];
  }
  const effective = question?._effectivePoints ?? defaults;
  const hasOverride = Boolean(normalizeText(question?._pointsOverrideRaw));
  return entries.map(([key, defaultValue]) => ({
    key,
    label: key,
    value:
      hasOverride && effective && typeof effective === "object" && !Array.isArray(effective)
        && Number.isFinite(Number(effective[key]))
        ? String(effective[key])
        : "",
    placeholder: String(defaultValue)
  }));
}

function buildQuestionInputRows(questions = []) {
  return (questions || []).map((question, index) => {
    const focus = question?.race_data_focus || {};
    const scoring = scoringSummary(question);
    const evidence = questionEvidence(question);
    return {
      question,
      id: normalizeText(question?.id),
      number: index + 1,
      prompt: normalizeText(question?.prompt),
      shortLabel: compactQuestionLabel(question, focus.metric),
      typeLabel: normalizeText(question?.type) || "text",
      basis: sourceBasis(question),
      basisLabel: basisLabel(question),
      derivationLabel: focus.metric ? raceDataFocusLabel(question) : "No race projection",
      evidenceLabel: evidence,
      scopeLabel: "season",
      derivationMeta: "Evidence: " + evidence + " · Season derivation",
      scoringLabel: scoring.label,
      pointsCurrentLabel: scoring.currentLabel,
      pointsDefaultLabel: compactPoints(question?._basePoints ?? question?.points),
      scoringDetail: scoring.detail,
      hasPointsOverride: scoring.hasOverride,
      pointsFields: numericPointsFields(question),
      pointsInputPlaceholder: pointsInputPlaceholder(question),
      pointsInputType:
        typeof (question?._basePoints ?? question?.points) === "number" ? "number" : "text",
      included: question?._included !== false,
      promptOverride: normalizeText(question?._promptOverrideRaw),
      pointsOverride: normalizeText(question?._pointsOverrideRaw),
      orderIndex: Number.isFinite(Number(question?._orderIndex))
        ? Number(question._orderIndex)
        : index
    };
  });
}

function normalizeQuestionInputEdits(questions = [], body = {}, {
  parsePointsOverride = null,
  validatePointsOverrideType = null
} = {}) {
  const sourceRows = (questions || []).map((question, index) => ({ question, index }));
  const seenOrders = new Set();
  const edits = sourceRows.map(({ question, index }) => {
    const id = normalizeText(question?.id);
    const orderRaw = normalizeText(body[`${id}__order`]);
    const order = Number(orderRaw);
    if (!Number.isInteger(order) || order < 1 || order > sourceRows.length) {
      throw new Error(`Question "${id}": order must be a unique number between 1 and ${sourceRows.length}.`);
    }
    if (seenOrders.has(order)) {
      throw new Error(`Question "${id}": order ${order} is already used.`);
    }
    seenOrders.add(order);

    const prompt = normalizeText(body[`${id}__prompt`]);
    if (!prompt) throw new Error(`Question "${id}": prompt cannot be empty.`);
    if (prompt.length > 500) throw new Error(`Question "${id}": prompt cannot exceed 500 characters.`);

    let pointsOverride = null;
    const basePoints = question?._basePoints;
    const structuredPoints =
      basePoints && typeof basePoints === "object" && !Array.isArray(basePoints)
      && Object.keys(basePoints).length > 0
      && Object.values(basePoints).every((value) => typeof value === "number" && Number.isFinite(value));
    if (structuredPoints) {
      const fieldNames = Object.keys(basePoints);
      const rawFields = fieldNames.map((key) => normalizeText(body[`${id}__points__${key}`]));
      if (rawFields.some(Boolean)) {
        if (rawFields.some((value) => !value)) {
          throw new Error(`Question "${id}": complete every scoring field or leave them all blank.`);
        }
        pointsOverride = Object.fromEntries(fieldNames.map((key, fieldIndex) => {
          const value = Number(rawFields[fieldIndex]);
          if (!Number.isFinite(value)) {
            throw new Error(`Question "${id}": scoring value for ${key} must be a finite number.`);
          }
          return [key, value];
        }));
      } else {
        const rawPoints = normalizeText(body[`${id}__points`]);
        if (rawPoints) {
          pointsOverride = parsePointsOverride
            ? parsePointsOverride(rawPoints, id)
            : JSON.parse(rawPoints);
        }
      }
    } else {
      const rawPoints = normalizeText(body[`${id}__points`]);
      if (rawPoints) {
        pointsOverride = parsePointsOverride
          ? parsePointsOverride(rawPoints, id)
          : JSON.parse(rawPoints);
      }
    }
    if (pointsOverride != null && validatePointsOverrideType) {
      validatePointsOverrideType(question, pointsOverride);
    }

    return {
      questionId: id,
      orderIndex: order - 1,
      promptOverride: prompt,
      pointsOverride,
      included: Boolean(body[`${id}__included`]),
      sourceIndex: index
    };
  });

  return edits.sort((a, b) => a.orderIndex - b.orderIndex || a.sourceIndex - b.sourceIndex);
}

module.exports = {
  BASIS_LABELS,
  buildQuestionInputRows,
  compactPoints,
  normalizeQuestionInputEdits,
  questionEvidence,
  scoringSummary,
  sourceBasis
};
