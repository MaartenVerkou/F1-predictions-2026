"use strict";

const REFERENCE_PATTERN = /^(driver|team|race):(\d+)$/;

function normalizeLabel(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function optionRecord(kind, row) {
  const label = String(row?.display_name_override || row?.display_name || row?.name || row?.label || "").trim();
  const id = Number(row?.id);
  if (!label || !Number.isInteger(id) || id <= 0) return null;
  return { id, kind, label, value: `${kind}:${id}`, slug: String(row.slug || "").trim() };
}

function buildCanonicalCatalog(catalog) {
  const groups = {
    driver: (catalog?.drivers || []).map((row) => optionRecord("driver", row)).filter(Boolean),
    team: (catalog?.teams || []).map((row) => optionRecord("team", row)).filter(Boolean),
    race: (catalog?.races || []).map((row) => optionRecord("race", row)).filter(Boolean)
  };
  return groups;
}

function canonicalReference(kind, raw, catalog) {
  const text = String(raw == null ? "" : raw).trim();
  if (!text) return text;
  const direct = text.match(REFERENCE_PATTERN);
  const options = catalog?.[kind] || [];
  if (direct && direct[1] === kind && options.some((option) => option.id === Number(direct[2]))) return text;
  const key = normalizeLabel(text);
  const match = options.find((option) => normalizeLabel(option.label) === key || normalizeLabel(option.slug) === key);
  return match ? match.value : text;
}

function canonicalAnyEntity(raw, catalog) {
  for (const kind of ["driver", "team", "race"]) {
    const candidate = canonicalReference(kind, raw, catalog);
    if (candidate !== raw) return candidate;
  }
  return raw;
}

function canonicalizeQuestionValue(question, value, catalog) {
  if (value == null) return value;
  const sourceKind = { drivers: "driver", teams: "team", races: "race" }[question?.options_source];
  const scalar = (raw, kind = sourceKind) => kind ? canonicalReference(kind, raw, catalog) : raw;
  const type = question?.type || "text";
  if (type === "ranking" || type === "multi_select") {
    return Array.isArray(value) ? value.map((item) => scalar(item)) : value;
  }
  if (type === "multi_select_limited") {
    if (Array.isArray(value)) return value.map((item) => scalar(item, "race"));
    if (value && typeof value === "object" && value.dnf_by_race) {
      return {
        ...value,
        dnf_by_race: Object.fromEntries(Object.entries(value.dnf_by_race).map(([race, count]) => [canonicalReference("race", race, catalog), count]))
      };
    }
    return value;
  }
  if (type === "teammate_battle") {
    return { ...value, winner: canonicalAnyEntity(value.winner, catalog) };
  }
  if (type === "boolean_with_optional_driver" || type === "numeric_with_driver" || type === "single_choice_with_driver") {
    const next = { ...value };
    if (Object.prototype.hasOwnProperty.call(next, "driver")) next.driver = canonicalReference("driver", next.driver, catalog);
    if (type === "single_choice_with_driver" && sourceKind) next.value = scalar(next.value);
    return next;
  }
  return scalar(value);
}

function displayQuestionValue(question, value, catalog) {
  if (value == null) return value;
  const lookup = (raw, kind) => {
    const match = String(raw).match(REFERENCE_PATTERN);
    const option = match && match[1] === kind ? (catalog?.[kind] || []).find((item) => item.id === Number(match[2])) : null;
    return option ? option.label : raw;
  };
  const sourceKind = { drivers: "driver", teams: "team", races: "race" }[question?.options_source];
  const scalar = (raw, kind = sourceKind) => kind ? lookup(raw, kind) : raw;
  const type = question?.type || "text";
  if (type === "ranking" || type === "multi_select") return Array.isArray(value) ? value.map((item) => scalar(item)) : value;
  if (type === "multi_select_limited") {
    if (Array.isArray(value)) return value.map((item) => scalar(item, "race"));
    if (value && typeof value === "object" && value.dnf_by_race) {
      return { ...value, dnf_by_race: Object.fromEntries(Object.entries(value.dnf_by_race).map(([race, count]) => [lookup(race, "race"), count])) };
    }
    return value;
  }
  if (type === "teammate_battle") return { ...value, winner: value.winner };
  if (type === "boolean_with_optional_driver" || type === "numeric_with_driver" || type === "single_choice_with_driver") {
    const next = { ...value };
    if (next.driver) next.driver = lookup(next.driver, "driver");
    if (type === "single_choice_with_driver" && sourceKind) next.value = scalar(next.value);
    return next;
  }
  return scalar(value);
}

module.exports = { buildCanonicalCatalog, canonicalReference, canonicalizeQuestionValue, displayQuestionValue, normalizeLabel };
