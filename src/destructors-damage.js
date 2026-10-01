"use strict";

function numeric(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function damageRowCost(row) {
  const explicitValue = row?.totalCost ?? row?.total_cost ?? row?.cost;
  const explicit = explicitValue == null || explicitValue === "" ? null : Number(explicitValue);
  if (Number.isFinite(explicit)) return Math.max(0, explicit);
  return (Array.isArray(row?.components) ? row.components : []).reduce(
    (total, component) => {
      const componentTotal = component?.totalCost ?? component?.total_cost;
      if (componentTotal != null && componentTotal !== "") {
        return total + Math.max(0, numeric(componentTotal));
      }
      return total + Math.max(0, numeric(component?.price, 0)) * Math.max(0, numeric(component?.quantity, 1));
    },
    0
  );
}

function damageRowRound(row) {
  return numeric(row?.round ?? row?.roundNumber, 0);
}

function damageRowEntity(row, entityType) {
  if (entityType === "team" || entityType === "constructor") {
    return String(row?.constructorName || row?.constructor || row?.team || row?.team_name || "").trim();
  }
  return String(row?.driverName || row?.driver || row?.driver_name || "").trim();
}

function damageRowsForRound(source, roundNumber) {
  if (source instanceof Map) return source.get(Number(roundNumber)) || [];
  if (!Array.isArray(source)) return [];
  return source.filter((row) => damageRowRound(row) === Number(roundNumber));
}

function aggregateDamageByEntity(source, { maxRound = null, entityType = "driver" } = {}) {
  const totals = new Map();
  const rows = source instanceof Map
    ? Array.from(source.values()).flat()
    : Array.isArray(source) ? source : [];
  rows.forEach((row) => {
    const round = damageRowRound(row);
    if (round < 1 || (maxRound != null && round > Number(maxRound))) return;
    const name = damageRowEntity(row, entityType);
    if (!name) return;
    totals.set(name, (totals.get(name) || 0) + damageRowCost(row));
  });
  return totals;
}

function topDamageEntities(source, { maxRound = null, entityType = "driver" } = {}) {
  const totals = aggregateDamageByEntity(source, { maxRound, entityType });
  const rows = Array.from(totals.entries())
    .map(([name, totalCost]) => ({ name, totalCost }))
    .filter((row) => row.totalCost > 0)
    .sort((left, right) => right.totalCost - left.totalCost || left.name.localeCompare(right.name));
  if (!rows.length) return [];
  const top = rows[0].totalCost;
  return rows.filter((row) => row.totalCost === top).map((row) => row.name);
}

function trimNumber(value, fractionDigits) {
  return Number(value.toFixed(fractionDigits)).toString();
}

function formatDamageCost(value) {
  const amount = numeric(value, null);
  if (amount == null) return "—";
  if (amount >= 1_000_000) return `$${trimNumber(amount / 1_000_000, amount >= 10_000_000 ? 1 : 2)}M`;
  if (amount >= 1_000) return `$${trimNumber(amount / 1_000, amount >= 100_000 ? 0 : 1)}K`;
  return `$${Math.round(amount)}`;
}

function formatDamageCostExact(value) {
  const amount = numeric(value, null);
  return amount == null ? "—" : `$${Math.round(amount).toLocaleString("en-US")}`;
}

module.exports = {
  aggregateDamageByEntity,
  damageRowCost,
  damageRowEntity,
  damageRowRound,
  damageRowsForRound,
  formatDamageCost,
  formatDamageCostExact,
  topDamageEntities
};
