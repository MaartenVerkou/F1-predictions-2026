"use strict";

const { normalizeScoringRules } = require("./season-scoring-rules");

const NON_CLASSIFIED_STATUS_RE = /^(dnf|ret|retired|retirement|dns|dnq|dsq|nc|not classified|did not start|did not qualify|withdrew|wd|disqualified|accident|collision|crash|mechanical|engine|gearbox|hydraulic|brake|electrical|damage|overheating|puncture|spin|illness|fuel|technical)/i;

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveInteger(value) {
  const parsed = numeric(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function entityName(row) {
  if (!row || typeof row !== "object") return "";
  if (row.entity != null) return String(row.entity).trim();
  if (row.name != null) return String(row.name).trim();
  if (row.driver != null) return String(row.driver).trim();
  const driver = row.Driver;
  if (typeof driver === "string") return driver.trim();
  return [driver?.givenName, driver?.familyName].filter(Boolean).join(" ").trim();
}

function classifiedFinish(row) {
  const status = String(row?.status || "").trim();
  return !status || !NON_CLASSIFIED_STATUS_RE.test(status);
}

function roundEntries(input) {
  if (input instanceof Map) {
    return Array.from(input.entries()).map(([round, rows]) => ({ round, rows }));
  }
  return Array.isArray(input) ? input : [];
}

function rowsForEntry(entry) {
  if (!entry || typeof entry !== "object") return [];
  return Array.isArray(entry.rows)
    ? entry.rows
    : Array.isArray(entry.raceRows)
      ? entry.raceRows
      : Array.isArray(entry.results)
        ? entry.results
        : [];
}

function buildFinishProfiles(raceRowsByRound, throughRound) {
  const profiles = new Map();
  roundEntries(raceRowsByRound)
    .filter((entry) => Number(entry.round) > 0 && Number(entry.round) <= throughRound)
    .sort((left, right) => Number(left.round) - Number(right.round))
    .forEach((entry) => {
      rowsForEntry(entry).forEach((row) => {
        const name = entityName(row);
        const position = positiveInteger(row?.position);
        if (!name || position == null || !classifiedFinish(row)) return;
        if (!profiles.has(name)) profiles.set(name, new Map());
        const counts = profiles.get(name);
        counts.set(position, (counts.get(position) || 0) + 1);
      });
    });
  return profiles;
}

function copyProfile(profile) {
  return new Map(profile ? profile.entries() : []);
}

function addFinish(profile, position, count = 1) {
  if (position == null || count <= 0) return;
  profile.set(position, (profile.get(position) || 0) + count);
}

/**
 * Compare two countback profiles. A positive result means `left` wins the
 * official highest-finish countback: most wins, then most second places, etc.
 */
function compareFinishProfiles(left, right) {
  const positions = new Set([
    ...Array.from(left?.keys?.() || []),
    ...Array.from(right?.keys?.() || [])
  ]);
  const maxPosition = Math.max(0, ...Array.from(positions));
  for (let position = 1; position <= maxPosition; position += 1) {
    const difference = (left?.get(position) || 0) - (right?.get(position) || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function normalizedStandingRows(entry, profileByName) {
  const source = Array.isArray(entry?.standings)
    ? entry.standings
    : Array.isArray(entry?.drivers)
      ? entry.drivers
      : [];
  return source
    .map((row, index) => ({
      name: entityName(row),
      points: numeric(row?.points) ?? 0,
      position: positiveInteger(row?.position) || index + 1,
      profile: profileByName.get(entityName(row)) || new Map()
    }))
    .filter((row) => row.name)
    .sort((left, right) => (
      right.points - left.points
      || compareFinishProfiles(right.profile, left.profile)
      || left.position - right.position
      || left.name.localeCompare(right.name)
    ));
}

function maximumPoints(table) {
  const values = Object.entries(table || {})
    .map(([position, points]) => ({ position: positiveInteger(position), points: numeric(points) }))
    .filter((entry) => entry.position != null && entry.points != null && entry.points >= 0);
  if (!values.length) return { points: 0, position: null };
  const points = Math.max(...values.map((entry) => entry.points));
  const position = values
    .filter((entry) => entry.points === points)
    .reduce((best, entry) => best == null || entry.position < best ? entry.position : best, null);
  return { points, position };
}

function sprintRoundsSet(input) {
  if (input instanceof Set) return input;
  return new Set(Array.isArray(input) ? input.map(Number).filter((round) => round > 0) : []);
}

function remainingWeekendPoints(round, totalRounds, sprintRounds, rules) {
  let total = maximumPoints(rules.racePoints).points;
  if (rules.fastestLap.eligible && rules.fastestLap.points > 0) total += rules.fastestLap.points;
  if (sprintRounds.has(Number(round))) total += maximumPoints(rules.sprintPoints).points;
  return total;
}

function computeTitleDecision({
  roundStandings = [],
  raceRowsByRound = [],
  totalRounds,
  sprintRoundSet = new Set(),
  scoringRules,
  cutoffRound
} = {}) {
  const finalRound = positiveInteger(totalRounds)
    || Math.max(0, ...roundEntries(roundStandings).map((entry) => Number(entry.round) || 0));
  const cutoff = Math.min(
    finalRound,
    positiveInteger(cutoffRound) || finalRound
  );
  if (!finalRound || !cutoff) return null;

  const rules = normalizeScoringRules(scoringRules);
  const sprintRounds = sprintRoundsSet(sprintRoundSet);
  const orderedRounds = roundEntries(roundStandings)
    .map((entry) => ({ ...entry, round: Number(entry.round) }))
    .filter((entry) => Number.isInteger(entry.round) && entry.round > 0 && entry.round <= cutoff)
    .sort((left, right) => left.round - right.round);
  if (!orderedRounds.length) return null;

  for (const entry of orderedRounds) {
    const profiles = buildFinishProfiles(raceRowsByRound, entry.round);
    const standings = normalizedStandingRows(entry, profiles);
    if (standings.length < 2) continue;
    const leader = standings[0];
    const remainingRaceCount = Math.max(0, finalRound - entry.round);
    let remainingPoints = 0;
    for (let round = entry.round + 1; round <= finalRound; round += 1) {
      remainingPoints += remainingWeekendPoints(round, finalRound, sprintRounds, rules);
    }
    const maxRace = maximumPoints(rules.racePoints);
    const leaderClinched = standings.slice(1).every((challenger) => {
      const gap = leader.points - challenger.points;
      if (gap > remainingPoints) return true;
      if (gap < remainingPoints) return false;

      const possibleChallengerProfile = copyProfile(challenger.profile);
      addFinish(possibleChallengerProfile, maxRace.position, remainingRaceCount);
      return compareFinishProfiles(leader.profile, possibleChallengerProfile) > 0;
    });
    if (leaderClinched) {
      return {
        racesBeforeEnd: finalRound - entry.round,
        decidedRound: entry.round,
        leader: leader.name,
        leaderPoints: leader.points,
        remainingPoints,
        pointsGap: leader.points - (standings[1]?.points ?? leader.points)
      };
    }
  }
  return null;
}

function computeTitleDecidedRacesBeforeEnd(options) {
  return computeTitleDecision(options)?.racesBeforeEnd ?? null;
}

module.exports = {
  compareFinishProfiles,
  computeTitleDecision,
  computeTitleDecidedRacesBeforeEnd
};
