"use strict";

const SEASON_STATUSES = Object.freeze(["planned", "active", "archived"]);

function normalizeSeasonStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return SEASON_STATUSES.includes(status) ? status : "planned";
}

function statusLabel(status) {
  return normalizeSeasonStatus(status);
}

function countForSeason(db, table, column, seasonId) {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = ?`).get(Number(seasonId));
  return Number(row?.count || 0);
}

function listAdminSeasons(db) {
  const rows = db.prepare("SELECT id, year, label, status, created_at, updated_at FROM seasons ORDER BY year DESC").all();
  return rows.map((row) => {
    const id = Number(row.id);
    const status = normalizeSeasonStatus(row.status);
    return {
      id,
      year: Number(row.year),
      label: String(row.label || row.year),
      status,
      statusLabel: statusLabel(status),
      editable: status !== "archived",
      syncable: status === "active",
      counts: {
        drivers: countForSeason(db, "season_drivers", "season_id", id),
        teams: countForSeason(db, "season_teams", "season_id", id),
        races: countForSeason(db, "races", "season_id", id),
        evidenceSnapshots: countForSeason(db, "race_data_snapshots", "season", Number(row.year)),
        actualSnapshots: countForSeason(db, "actual_snapshots", "season", Number(row.year))
      }
    };
  });
}

function resolveAdminSeasonContext(db, { requestedSeason, currentSeason }) {
  const availableSeasons = listAdminSeasons(db);
  const requested = String(requestedSeason ?? "").trim();
  const hasRequestedSeason = requested !== "";
  const requestedYear = hasRequestedSeason ? Number(requested) : Number(currentSeason);
  const selected = availableSeasons.find((season) => season.year === requestedYear) || null;
  const invalidRequestedSeason = hasRequestedSeason && !selected;
  return {
    availableSeasons,
    selected,
    year: selected?.year ?? (Number.isFinite(requestedYear) ? requestedYear : null),
    seasonId: selected?.id ?? null,
    status: selected?.status ?? null,
    editable: Boolean(selected?.editable),
    syncable: Boolean(selected?.syncable),
    isValid: Boolean(selected) && !invalidRequestedSeason,
    invalidRequestedSeason,
    hasRequestedSeason,
    empty: !selected
  };
}

function assertSeasonMutationAllowed(context, { historicalCorrection = false, preparation = false } = {}) {
  if (!context?.selected || !context.isValid) {
    throw new Error("The selected season is not available.");
  }
  if (context.status === "archived" && !historicalCorrection) {
    throw new Error("Archived seasons are read-only. Confirm a historical correction before changing them.");
  }
  if (context.status === "planned" && !preparation) {
    throw new Error("Planned seasons require an explicit preparation action before changing them.");
  }
  return context.selected;
}

module.exports = {
  SEASON_STATUSES,
  normalizeSeasonStatus,
  listAdminSeasons,
  resolveAdminSeasonContext,
  assertSeasonMutationAllowed
};
