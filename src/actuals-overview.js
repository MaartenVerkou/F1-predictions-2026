"use strict";

const {
  actualOverviewViewForQuestion,
  formatActualOverviewValue
} = require("./race-data-review-model");

function normalizeRoundNumber(value) {
  const roundNumber = Number(value);
  return Number.isFinite(roundNumber) && roundNumber > 0
    ? Math.floor(roundNumber)
    : null;
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
    return {
      key: `round:${roundNumber}`,
      roundNumber,
      raceName,
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
      cells: targets.map((target) => {
        const values = valuesByRound.get(target.roundNumber) || {};
        const rawValue = values[question.id];
        const hasValue = rawValue != null && String(rawValue).trim() !== "";
        return {
          value: formatActualOverviewValue(rawValue),
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
