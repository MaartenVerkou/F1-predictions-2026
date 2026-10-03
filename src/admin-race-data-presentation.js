"use strict";

/* Pure presentation helpers for the Race Data review workspace. Keeping these
   out of the route registration file makes the evidence/HTTP boundary easier
   to audit without changing the underlying canonical data model. */

function auditResultLabel(row) {
  if (!row) return "—";
  const raw = String(row.status || row.positionText || "").trim();
  const key = raw.toLowerCase();
  if (key.includes("retir") || key === "dnf") return "Ret";
  if (key.includes("did not start") || key === "dns") return "DNS";
  if (key.includes("did not qualify") || key === "dnq") return "DNQ";
  if (key.includes("disqual") || key === "dsq") return "DSQ";
  if (key.includes("not classified") || key === "nc") return "NC";
  if (key.includes("withdrew") || key === "wd") return "WD";
  const position = Number(row.position);
  if (Number.isFinite(position) && position > 0) return String(position);
  return raw || "—";
}

function auditNonClassifiedLabel(row) {
  const label = auditResultLabel(row);
  return ["Ret", "DNS", "DNQ", "DSQ", "NC", "WD"].includes(label) ? label : null;
}

function formatRaceStatusLabel(row) {
  if (!row) return "—";
  const rawStatus = String(row.status || "").trim().toLowerCase();
  const auditLabel = auditResultLabel(row);
  const explicitLabel = {
    dnf: "DNF",
    dns: "DNS",
    dsq: "DSQ",
    dnq: "DNQ",
    nc: "NC",
    wd: "WD"
  }[rawStatus] || null;
  const label = explicitLabel || (auditLabel === "—" ? "NC" : auditLabel);
  const rawGap = Array.isArray(row.sessionGap) ? row.sessionGap.find(Boolean) : row.sessionGap;
  const gap = String(rawGap || row.gap_to_leader || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bLAPS?\b/i, "laps");
  if (label === "NC" && gap) return gap;
  if (explicitLabel) return explicitLabel;
  const position = Number(row.position);
  if (Number.isFinite(position) && position > 0) return "Finished";
  return label;
}

function formatRacePositionLabel(row) {
  if (!row) return "—";
  const position = Number(row.position);
  return Number.isFinite(position) && position > 0 ? String(position) : "NC";
}

function fallbackEntityCode(value, kind = "driver") {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  if (kind === "team" && parts.length > 1) {
    const condensed = parts.join("").replace(/[^A-Za-z0-9]/g, "");
    if (condensed) return condensed.slice(0, 3).toUpperCase();
  }
  const lastPart = parts.at(-1).replace(/[^A-Za-z0-9]/g, "");
  return (lastPart || parts.join("")).slice(0, 3).toUpperCase() || "—";
}

function fallbackRaceCode(value) {
  const words = String(value || "")
    .replace(/[^A-Za-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !["grand", "prix", "gp"].includes(word.toLowerCase()));
  if (!words.length) return "—";
  if (words.length > 1) return `${words[0][0] || ""}${words[1].slice(0, 2)}`.toUpperCase();
  return words[0].slice(0, 3).toUpperCase() || "—";
}

function isSafeRaceDataReturnPath(value) {
  const path = String(value || "").trim();
  return /^\/admin\/race-data(?:[?#]|$)/.test(path)
    && !path.includes("://")
    && !path.startsWith("//");
}

function sortAuditRows(rows, valueField = "points") {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = Number(left.row[valueField]);
      const rightValue = Number(right.row[valueField]);
      const leftHasValue = Number.isFinite(leftValue);
      const rightHasValue = Number.isFinite(rightValue);
      if (leftHasValue !== rightHasValue) return leftHasValue ? -1 : 1;
      if (leftHasValue && leftValue !== rightValue) return rightValue - leftValue;
      const leftPosition = Number(left.row.championshipPosition);
      const rightPosition = Number(right.row.championshipPosition);
      const leftHasPosition = Number.isFinite(leftPosition);
      const rightHasPosition = Number.isFinite(rightPosition);
      if (leftHasPosition !== rightHasPosition) return leftHasPosition ? -1 : 1;
      if (leftHasPosition && leftPosition !== rightPosition) return leftPosition - rightPosition;
      return left.index - right.index;
    })
    .map(({ row }) => row);
}

function matchesAuditEntity(row, entity, { idField, nameField }) {
  if (!row || !entity) return false;
  if (entity.id != null && row[idField] != null) return Number(row[idField]) === Number(entity.id);
  return row[nameField] === entity.name;
}

function buildAuditMarkerMeta({ pole = false, fastestLap = false } = {}) {
  const markers = [];
  if (pole) markers.push("P");
  if (fastestLap) markers.push("FL");
  return {
    markers,
    markerGlyph: markers.join(" "),
    markerTitle: [pole ? "Pole position" : null, fastestLap ? "Fastest lap" : null]
      .filter(Boolean)
      .join(" · ")
  };
}

function buildConstructorPodiumPosition(raceRows, entity) {
  const bestPosition = (raceRows || [])
    .filter((row) => matchesAuditEntity(row, entity, { idField: "team_id", nameField: "constructor" }))
    .map((row) => Number(row.position))
    .filter((position) => Number.isInteger(position) && position >= 1 && position <= 3)
    .sort((left, right) => left - right)[0];
  return bestPosition || null;
}

function buildAuditPodiumSummary(cells) {
  const podiumCells = (cells || []).filter((cell) => !cell.afterCutoff && cell.podiumPosition);
  return {
    wins: podiumCells.filter((cell) => cell.podiumPosition === 1).length,
    podiums: podiumCells.length
  };
}

function buildAuditMatrixCell({
  round,
  cutoffRoundNumber,
  label,
  title,
  state = round.state,
  podiumPosition = null,
  markers = [],
  markerGlyph = "",
  markerTitle = "",
  focusHit = false
}) {
  const afterCutoff = round.roundNumber > cutoffRoundNumber;
  return {
    label: label == null ? "—" : String(label),
    state: afterCutoff ? "future" : state,
    afterCutoff,
    podiumPosition: afterCutoff ? null : podiumPosition,
    markers,
    markerGlyph,
    markerTitle,
    focusHit: afterCutoff ? false : focusHit,
    title: afterCutoff ? ["After selected round", title].filter(Boolean).join(" · ") : title
  };
}

module.exports = {
  auditResultLabel,
  auditNonClassifiedLabel,
  formatRaceStatusLabel,
  formatRacePositionLabel,
  fallbackEntityCode,
  fallbackRaceCode,
  isSafeRaceDataReturnPath,
  sortAuditRows,
  matchesAuditEntity,
  buildAuditMarkerMeta,
  buildConstructorPodiumPosition,
  buildAuditPodiumSummary,
  buildAuditMatrixCell
};
