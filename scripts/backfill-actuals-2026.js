"use strict";

const fs = require("fs");
const path = require("path");
const {
  REVIEW_STATUS_PENDING,
  ensureActualSnapshotColumns,
  fetchSnapshotValues,
  findLatestSnapshotForRound,
  normalizeReviewStatus,
  snapshotValuesEqual
} = require("../src/actuals-snapshots");
const { createAppDatabase } = require("../src/app-database");
const { ensurePostgresSchema } = require("../src/postgres-schema");
const { resolveConfiguredRaceName } = require("../src/race-names");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const QUESTIONS_PATH = process.env.QUESTIONS_PATH || path.join(DATA_DIR, "questions.json");
const ROSTER_PATH = process.env.ROSTER_PATH || path.join(DATA_DIR, "roster.json");
const RACES_PATH = process.env.RACES_PATH || path.join(DATA_DIR, "races.json");
const SEASON = Number(process.env.F1_SEASON || 2026);
const API_BASE = "https://api.jolpi.ca/ergast/f1";
const FORMULA1_DOTD_URL = `https://www.formula1.com/en/results/${SEASON}/awards/driver-of-the-day`;
const USER_AGENT = "f1-predictions-actuals-backfill";
const BACKFILL_SOURCE_NOTE =
  "Backfilled from Jolpica/Ergast, Formula1.com results, and manual 2026-06-06 engine-supplier announcement review";
const TEAM_ENGINE_SWITCH_2027_2028_ACTUAL = "no";
const CANCELLED_RACES_2026 = [
  "Bahrain Grand Prix",
  "Saudi Arabian Grand Prix"
];
const ORIGINAL_DNF_RACE_ORDER_2026 = [
  "Australian Grand Prix",
  "Chinese Grand Prix",
  "Japanese Grand Prix",
  "Bahrain Grand Prix",
  "Saudi Arabian Grand Prix",
  "Miami Grand Prix",
  "Canadian Grand Prix",
  "Monaco Grand Prix",
  "Barcelona-Catalunya Grand Prix",
  "Austrian Grand Prix",
  "British Grand Prix",
  "Belgian Grand Prix",
  "Hungarian Grand Prix",
  "Dutch Grand Prix",
  "Italian Grand Prix",
  "Spanish Grand Prix",
  "Azerbaijan Grand Prix",
  "Singapore Grand Prix",
  "United States Grand Prix",
  "Mexico City Grand Prix",
  "Sao Paulo Grand Prix",
  "Las Vegas Grand Prix",
  "Qatar Grand Prix",
  "Abu Dhabi Grand Prix"
];

const DRIVER_NAME_ALIASES = {
  andreakimiantonelli: "Kimi Antonelli",
  carlossainz: "Carlos Sainz Jr.",
  carlossainzjr: "Carlos Sainz Jr.",
  nicohulkenberg: "Nico Hulkenberg",
  nicohuelkenberg: "Nico Hulkenberg"
};

const TEAM_NAME_ALIASES = {
  redbull: "Red Bull Racing",
  redbullracing: "Red Bull Racing",
  rbf1team: "Racing Bulls",
  racingbulls: "Racing Bulls",
  cadillacf1team: "Cadillac",
  alpinef1team: "Alpine",
  astonmartinf1team: "Aston Martin"
};

const MERCEDES_ENGINE_TEAMS_2026 = new Set([
  "Mercedes",
  "McLaren",
  "Williams",
  "Alpine"
]);

const MULTI_ACTUAL_SINGLE_CHOICE_IDS = new Set([
  "most_driver_of_the_day",
  "most_dnfs_driver",
  "destructors_driver",
  "destructors_team",
  "most_points_no_podium",
  "closest_qualifying_teammates"
]);

const MULTI_ACTUAL_DRIVER_FIELD_IDS = new Set(["lowest_grid_win_position"]);

function parseArgs(argv) {
  const args = {
    apply: false,
    dryRun: true,
    dbPath: process.env.DB_PATH || path.join(DATA_DIR, "app.db"),
    databaseUrl: String(process.env.DATABASE_URL || "").trim(),
    season: SEASON,
    maxRound: null
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      args.apply = true;
      args.dryRun = false;
    } else if (arg === "--dry-run") {
      args.apply = false;
      args.dryRun = true;
    } else if (arg.startsWith("--db=")) {
      args.dbPath = path.resolve(arg.slice("--db=".length));
    } else if (arg.startsWith("--database-url=")) {
      args.databaseUrl = String(arg.slice("--database-url=".length)).trim();
    } else if (arg.startsWith("--season=")) {
      args.season = Number(arg.slice("--season=".length));
    } else if (arg.startsWith("--max-round=")) {
      args.maxRound = Number(arg.slice("--max-round=".length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.season) || args.season <= 0) {
    throw new Error("--season must be a positive number.");
  }
  if (args.maxRound != null && (!Number.isFinite(args.maxRound) || args.maxRound <= 0)) {
    throw new Error("--max-round must be a positive number.");
  }
  return args;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

async function fetchJson(url) {
  for (let attempt = 0; attempt <= 5; attempt += 1) {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT }
    });
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < 5) {
      const retryAfter = Number(res.headers.get("retry-after") || 0);
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : 750 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  throw new Error(`Failed to fetch after retries: ${url}`);
}

function withPagination(url, limit, offset) {
  const parsed = new URL(url);
  parsed.searchParams.set("limit", String(limit));
  parsed.searchParams.set("offset", String(offset));
  return parsed.toString();
}

function mergeRaceRows(existing, incoming, resultKey) {
  if (!existing) {
    return {
      ...incoming,
      [resultKey]: Array.isArray(incoming?.[resultKey]) ? incoming[resultKey].slice() : []
    };
  }
  const merged = existing;
  const seen = new Set(
    (merged[resultKey] || []).map((row) =>
      [row?.number, row?.Driver?.driverId, row?.position, row?.grid].join(":")
    )
  );
  for (const row of incoming?.[resultKey] || []) {
    const key = [row?.number, row?.Driver?.driverId, row?.position, row?.grid].join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    merged[resultKey].push(row);
  }
  return merged;
}

async function fetchAllRaceTableRaces(url, resultKey) {
  const limit = 100;
  let offset = 0;
  let total = Infinity;
  const byRound = new Map();

  while (offset < total) {
    const payload = await fetchJson(withPagination(url, limit, offset));
    total = parseNum(payload?.MRData?.total, 0);
    const pageLimit = parseNum(payload?.MRData?.limit, limit) || limit;
    const races = payload?.MRData?.RaceTable?.Races || [];
    for (const race of races) {
      const round = Number(race.round);
      if (!Number.isFinite(round)) continue;
      byRound.set(round, mergeRaceRows(byRound.get(round), race, resultKey));
    }
    offset += pageLimit;
    if (pageLimit <= 0) break;
  }

  return Array.from(byRound.values()).sort((a, b) => parseNum(a.round) - parseNum(b.round));
}

async function fetchText(url) {
  for (let attempt = 0; attempt <= 5; attempt += 1) {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT }
    });
    if (res.ok) return res.text();
    if (res.status === 429 && attempt < 5) {
      const retryAfter = Number(res.headers.get("retry-after") || 0);
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : 750 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      continue;
    }
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  throw new Error(`Failed to fetch after retries: ${url}`);
}

function normalizeLookupKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function resolveCanonicalName(raw, allowedValues, aliasMap = {}) {
  const key = normalizeLookupKey(raw);
  if (!key) return null;
  const aliased = aliasMap[key];
  if (aliased && (allowedValues || []).includes(aliased)) return aliased;
  return (allowedValues || []).find((value) => normalizeLookupKey(value) === key) || null;
}

function driverNameFromApi(driver, rosterDrivers) {
  if (!driver) return null;
  const raw = `${driver.givenName || ""} ${driver.familyName || ""}`.trim();
  return resolveCanonicalName(raw, rosterDrivers, DRIVER_NAME_ALIASES);
}

function teamNameFromApi(constructor, rosterTeams) {
  if (!constructor) return null;
  return resolveCanonicalName(constructor.name, rosterTeams, TEAM_NAME_ALIASES);
}

function parseNum(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isDnfStatus(statusRaw) {
  const status = String(statusRaw || "").toLowerCase();
  if (!status) return false;
  if (status.includes("finished") || status.includes("lapped") || status.startsWith("+")) {
    return false;
  }
  if (
    status.includes("disqual") ||
    status.includes("did not start") ||
    status.includes("did not qualify") ||
    status.includes("withdrew")
  ) {
    return false;
  }
  return true;
}

function stripHtmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shortRaceLabel(raceName) {
  return String(raceName || "")
    .replace(/^The\s+/i, "")
    .replace(/\s+Grand Prix$/i, "")
    .replace("Canadian", "Canada")
    .replace("Chinese", "China")
    .replace("Japanese", "Japan")
    .replace("Australian", "Australia")
    .trim();
}

function parseDriverOfTheDayByRound(html, completedRaces, rosterDrivers) {
  const text = stripHtmlToText(html);
  const marker = "Salesforce Driver of the Day RESULTS";
  const start = text.indexOf(marker);
  if (start < 0) return new Map();
  const section = text.slice(start + marker.length);
  const byRound = new Map();

  for (let index = 0; index < completedRaces.length; index += 1) {
    const race = completedRaces[index];
    const label = shortRaceLabel(race.raceName);
    const currentIndex = section.search(new RegExp(`\\b${escapeRegExp(label)}\\b`, "i"));
    if (currentIndex < 0) continue;

    let nextIndex = section.length;
    for (let next = index + 1; next < completedRaces.length; next += 1) {
      const nextLabel = shortRaceLabel(completedRaces[next].raceName);
      const offset = section
        .slice(currentIndex + label.length)
        .search(new RegExp(`\\b${escapeRegExp(nextLabel)}\\b`, "i"));
      if (offset >= 0) {
        nextIndex = currentIndex + label.length + offset;
        break;
      }
    }

    const chunk = section.slice(currentIndex, nextIndex);
    const winner = (rosterDrivers || []).find((driver) =>
      new RegExp(`\\b${escapeRegExp(driver)}\\b`, "i").test(chunk)
    );
    if (winner) byRound.set(Number(race.round), winner);
  }

  return byRound;
}

function pickTopTiedRows(rows, getScore) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  list.sort((a, b) => {
    const diff = getScore(b) - getScore(a);
    if (diff !== 0) return diff;
    return String(a?.name || a?.team || "").localeCompare(String(b?.name || b?.team || ""));
  });
  if (list.length === 0) return [];
  const topScore = getScore(list[0]);
  return list.filter((row) => getScore(row) === topScore);
}

function pickClosestTeams(qualStats) {
  const rows = Array.from(qualStats.entries())
    .map(([team, stat]) => ({
      team,
      total: Number(stat.aWins || 0) + Number(stat.bWins || 0),
      diff: Math.abs(Number(stat.aWins || 0) - Number(stat.bWins || 0))
    }))
    .filter((row) => row.total > 0)
    .sort((a, b) => {
      if (a.diff !== b.diff) return a.diff - b.diff;
      if (b.total !== a.total) return b.total - a.total;
      return a.team.localeCompare(b.team);
    });
  if (rows.length === 0) return [];
  const first = rows[0];
  return rows
    .filter((row) => row.diff === first.diff && row.total === first.total)
    .map((row) => row.team);
}

function collapseTiedActuals(questionId, values) {
  const filtered = Array.isArray(values)
    ? values.filter((value) => value != null && value !== "")
    : [];
  if (filtered.length === 0) return null;
  if (
    MULTI_ACTUAL_SINGLE_CHOICE_IDS.has(questionId) ||
    MULTI_ACTUAL_DRIVER_FIELD_IDS.has(questionId)
  ) {
    return filtered.length === 1 ? filtered[0] : filtered;
  }
  return filtered[0];
}

function computeTitleDecidedRacesBeforeEnd(roundStandings, totalRounds, sprintRoundSet) {
  const ordered = Array.isArray(roundStandings) ? roundStandings.slice() : [];
  if (ordered.length === 0) return null;
  const maxWeekendPoints = (roundNumber) =>
    26 + (sprintRoundSet.has(Number(roundNumber)) ? 8 : 0);

  for (let index = 0; index < ordered.length; index += 1) {
    const entry = ordered[index];
    const standings = Array.isArray(entry?.standings) ? entry.standings : [];
    if (standings.length < 2) continue;

    const leaderPoints = parseNum(standings[0]?.points);
    const secondPoints = parseNum(standings[1]?.points);
    let maxRemainingPoints = 0;
    for (let round = Number(entry.round) + 1; round <= totalRounds; round += 1) {
      maxRemainingPoints += maxWeekendPoints(round);
    }

    if (leaderPoints - secondPoints > maxRemainingPoints) {
      return totalRounds - Number(entry.round);
    }
  }
  return 0;
}

function serializeAnswerForStorage(question, answerValue) {
  if (answerValue == null || answerValue === "") return null;
  const type = question.type || "text";
  if (type === "single_choice" && Array.isArray(answerValue)) return JSON.stringify(answerValue);
  if (
    type === "ranking" ||
    type === "multi_select" ||
    type === "multi_select_limited" ||
    type === "teammate_battle" ||
    type === "boolean_with_optional_driver" ||
    type === "numeric_with_driver" ||
    type === "single_choice_with_driver"
  ) {
    return JSON.stringify(answerValue);
  }
  if (type === "numeric") return String(Number(answerValue));
  return String(answerValue);
}

function serializedActualsForRound({ questions, roster, races, data, roundNumber, totalRounds }) {
  const questionsById = Object.fromEntries((questions || []).map((question) => [question.id, question]));
  const driverStandings = data.driverStandingsByRound.get(roundNumber) || [];
  const constructorStandings = data.constructorStandingsByRound.get(roundNumber) || [];
  const completedRaces = data.results.filter((race) => Number(race.round) <= roundNumber);
  const completedQualifying = data.qualifying.filter((race) => Number(race.round) <= roundNumber);
  const completedSprints = data.sprints.filter((race) => Number(race.round) <= roundNumber);
  const completedRoundNumbers = completedRaces.map((race) => Number(race.round));

  const pointsByDriver = new Map();
  driverStandings.forEach((row) => {
    const driver = driverNameFromApi(row.Driver, roster.drivers || []);
    if (driver) pointsByDriver.set(driver, parseNum(row.points));
  });

  const podiumDrivers = new Set();
  const podiumTeams = new Set();
  const dnfCountsByDriver = new Map();
  const dnfByRace = Object.fromEntries(
    ORIGINAL_DNF_RACE_ORDER_2026.map((raceName) => [raceName, 0])
  );
  CANCELLED_RACES_2026.forEach((raceName) => {
    dnfByRace[raceName] = 0;
  });
  const winnerGridRows = [];
  const qualStats = new Map();
  const sprintPointsByDriver = new Map();
  const sprintRoundSet = new Set();

  completedRaces.forEach((race) => {
    const raceName =
      resolveConfiguredRaceName(race.raceName, races || []) ||
      String(race.raceName || "").trim();
    const apiResults = Array.isArray(race.Results) ? race.Results : [];
    let dnfCountThisRace = 0;

    apiResults.forEach((row) => {
      const driver = driverNameFromApi(row.Driver, roster.drivers || []);
      const team = teamNameFromApi(row.Constructor, roster.teams || []);
      const position = parseNum(row.position, 0);

      if (position >= 1 && position <= 3 && driver) podiumDrivers.add(driver);
      if (position >= 1 && position <= 3 && team) podiumTeams.add(team);

      if (driver && isDnfStatus(row.status)) {
        dnfCountThisRace += 1;
        dnfCountsByDriver.set(driver, (dnfCountsByDriver.get(driver) || 0) + 1);
      }

      if (position === 1 && driver) {
        const grid = parseNum(row.grid, 0);
        winnerGridRows.push({
          raceName,
          driver,
          grid: grid > 22 ? 23 : grid
        });
      }
    });

    if (raceName) dnfByRace[raceName] = dnfCountThisRace;
  });

  completedQualifying.forEach((race) => {
    const rows = Array.isArray(race.QualifyingResults) ? race.QualifyingResults : [];
    const byTeam = new Map();
    rows.forEach((row) => {
      const team = teamNameFromApi(row.Constructor, roster.teams || []);
      const driver = driverNameFromApi(row.Driver, roster.drivers || []);
      if (!team || !driver) return;
      if (!byTeam.has(team)) byTeam.set(team, []);
      byTeam.get(team).push({ driver, position: parseNum(row.position, 999) });
    });
    byTeam.forEach((drivers, team) => {
      if (drivers.length < 2) return;
      const sorted = drivers.slice().sort((a, b) => a.position - b.position).slice(0, 2);
      if (!qualStats.has(team)) {
        qualStats.set(team, {
          aName: sorted[0].driver,
          bName: sorted[1].driver,
          aWins: 0,
          bWins: 0
        });
      }
      const stat = qualStats.get(team);
      if (sorted[0].driver === stat.aName) stat.aWins += 1;
      else if (sorted[0].driver === stat.bName) stat.bWins += 1;
      else if (stat.aWins <= stat.bWins) {
        stat.aName = sorted[0].driver;
        stat.aWins += 1;
      } else {
        stat.bName = sorted[0].driver;
        stat.bWins += 1;
      }
    });
  });

  completedSprints.forEach((race) => {
    const sprintRows = Array.isArray(race.SprintResults) ? race.SprintResults : [];
    if (sprintRows.length > 0) sprintRoundSet.add(Number(race.round));
    sprintRows.forEach((row) => {
      const driver = driverNameFromApi(row.Driver, roster.drivers || []);
      if (!driver) return;
      sprintPointsByDriver.set(
        driver,
        (sprintPointsByDriver.get(driver) || 0) + parseNum(row.points, 0)
      );
    });
  });

  const dotdCounts = new Map();
  completedRoundNumbers.forEach((round) => {
    const winner = data.driverOfTheDayByRound.get(round);
    if (winner) dotdCounts.set(winner, (dotdCounts.get(winner) || 0) + 1);
  });

  const firstRaceWinner = winnerGridRows[0] || null;
  const lowestGridWins = winnerGridRows
    .slice()
    .sort((a, b) => b.grid - a.grid || a.raceName.localeCompare(b.raceName));
  const lowestGridWin = lowestGridWins[0] || null;
  const lowestGridWinDrivers = lowestGridWin
    ? collapseTiedActuals(
        "lowest_grid_win_position",
        lowestGridWins.filter((row) => row.grid === lowestGridWin.grid).map((row) => row.driver)
      )
    : null;
  const constructorsNoPodium = constructorStandings
    .map((row) => ({
      name: teamNameFromApi(row.Constructor, roster.teams || []),
      points: parseNum(row.points)
    }))
    .filter((row) => row.name && !podiumTeams.has(row.name));
  const mostDnfDrivers = pickTopTiedRows(
    Array.from(dnfCountsByDriver.entries()).map(([name, count]) => ({ name, count })),
    (row) => Number(row.count || 0)
  ).map((row) => row.name);
  const topNoPodiumTeams = pickTopTiedRows(
    constructorsNoPodium.map((row) => ({ name: row.name, points: row.points })),
    (row) => Number(row.points || 0)
  ).map((row) => row.name);
  const closestQualifyingTeams = pickClosestTeams(qualStats);
  const mostDriverOfTheDayDrivers = pickTopTiedRows(
    Array.from(dotdCounts.entries()).map(([name, count]) => ({ name, count })),
    (row) => Number(row.count || 0)
  ).map((row) => row.name);
  const currentLeader = driverNameFromApi(driverStandings[0]?.Driver, roster.drivers || []);
  const topSprintRows = Array.from(sprintPointsByDriver.entries())
    .map(([name, points]) => ({ name, points }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const uniqueSprintLeader =
    topSprintRows.length > 0 &&
    (topSprintRows.length === 1 || topSprintRows[0].points > topSprintRows[1].points)
      ? topSprintRows[0].name
      : null;
  const roundStandings = completedRoundNumbers.map((round) => ({
    round,
    standings: data.driverStandingsByRound.get(round) || []
  }));

  const rawActuals = {
    drivers_championship_top_3: driverStandings
      .slice(0, 3)
      .map((row) => driverNameFromApi(row.Driver, roster.drivers || []))
      .filter(Boolean),
    constructors_championship_top_3: constructorStandings
      .slice(0, 3)
      .map((row) => teamNameFromApi(row.Constructor, roster.teams || []))
      .filter(Boolean),
    drivers_championship_last: driverNameFromApi(
      driverStandings[driverStandings.length - 1]?.Driver,
      roster.drivers || []
    ),
    constructors_championship_last: teamNameFromApi(
      constructorStandings[constructorStandings.length - 1]?.Constructor,
      roster.teams || []
    ),
    lowest_grid_win_position: lowestGridWin
      ? {
          value: lowestGridWin.grid >= 23 ? "Pitlane" : String(lowestGridWin.grid),
          driver: lowestGridWinDrivers
        }
      : null,
    all_podium_finishers: Array.from(podiumDrivers).sort((a, b) => a.localeCompare(b)),
    most_driver_of_the_day: collapseTiedActuals(
      "most_driver_of_the_day",
      mostDriverOfTheDayDrivers
    ),
    most_points_no_podium:
      constructorsNoPodium.length > 0
        ? collapseTiedActuals("most_points_no_podium", topNoPodiumTeams)
        : String(questionsById.most_points_no_podium?.bonus_value || "All teams scored a podium"),
    most_dnfs_driver: collapseTiedActuals("most_dnfs_driver", mostDnfDrivers),
    teammate_battle_antonelli_russell: (() => {
      const question = questionsById.teammate_battle_antonelli_russell;
      const pair = Array.isArray(question?.options) ? question.options.slice(0, 2) : [];
      if (pair.length < 2) return null;
      const left = parseNum(pointsByDriver.get(pair[0]));
      const right = parseNum(pointsByDriver.get(pair[1]));
      return {
        winner: left === right ? "tie" : left > right ? pair[0] : pair[1],
        diff: Math.abs(left - right)
      };
    })(),
    teammate_battle_lawson_lindblad: (() => {
      const question = questionsById.teammate_battle_lawson_lindblad;
      const pair = Array.isArray(question?.options) ? question.options.slice(0, 2) : [];
      if (pair.length < 2) return null;
      const left = parseNum(pointsByDriver.get(pair[0]));
      const right = parseNum(pointsByDriver.get(pair[1]));
      return {
        winner: left === right ? "tie" : left > right ? pair[0] : pair[1],
        diff: Math.abs(left - right)
      };
    })(),
    closest_qualifying_teammates: collapseTiedActuals(
      "closest_qualifying_teammates",
      closestQualifyingTeams
    ),
    alpine_vs_cadillac_audi:
      parseNum(
        constructorStandings.find(
          (row) => teamNameFromApi(row.Constructor, roster.teams || []) === "Alpine"
        )?.points
      ) >
      parseNum(
        constructorStandings.find(
          (row) => teamNameFromApi(row.Constructor, roster.teams || []) === "Cadillac"
        )?.points
      ) +
        parseNum(
          constructorStandings.find(
            (row) => teamNameFromApi(row.Constructor, roster.teams || []) === "Audi"
          )?.points
        ) +
        parseNum(
          constructorStandings.find(
            (row) => teamNameFromApi(row.Constructor, roster.teams || []) === "Aston Martin"
          )?.points
        )
        ? "More"
        : "Less",
    select_three_races_dnfs: { dnf_by_race: dnfByRace },
    races_before_title_decided: computeTitleDecidedRacesBeforeEnd(
      roundStandings,
      totalRounds,
      sprintRoundSet
    ),
    all_teams_score_points: constructorStandings.every((row) => parseNum(row.points) > 0)
      ? "yes"
      : "no",
    mini_q1_first_race_winner_champion:
      firstRaceWinner && currentLeader && firstRaceWinner.driver === currentLeader ? "yes" : "no",
    mini_q2_mercedes_engines_top5:
      constructorStandings
        .slice(0, 5)
        .map((row) => teamNameFromApi(row.Constructor, roster.teams || []))
        .filter((team) => MERCEDES_ENGINE_TEAMS_2026.has(team)).length >= 4
        ? "yes"
        : "no",
    mini_q3_ferrari_podium: ["Charles Leclerc", "Lewis Hamilton"].every((driver) =>
      podiumDrivers.has(driver)
    )
      ? "yes"
      : "no",
    mini_q4_sprint_champion_same:
      uniqueSprintLeader && currentLeader && uniqueSprintLeader === currentLeader ? "yes" : "no",
    mini_q5_team_engine_switch_2027_2028: TEAM_ENGINE_SWITCH_2027_2028_ACTUAL
  };

  const serialized = {};
  for (const question of questions) {
    if (!Object.prototype.hasOwnProperty.call(rawActuals, question.id)) continue;
    const value = serializeAnswerForStorage(question, rawActuals[question.id]);
    if (value != null && value !== "") serialized[question.id] = value;
  }
  return serialized;
}

async function fetchSeasonData({ season, roster }) {
  const [resultsJson, qualifyingJson, sprintJson, dotdHtml] = await Promise.all([
    fetchAllRaceTableRaces(`${API_BASE}/${season}/results.json`, "Results"),
    fetchAllRaceTableRaces(`${API_BASE}/${season}/qualifying.json`, "QualifyingResults"),
    fetchAllRaceTableRaces(`${API_BASE}/${season}/sprint.json`, "SprintResults"),
    fetchText(FORMULA1_DOTD_URL).catch(() => "")
  ]);

  const results = resultsJson || [];
  const qualifying = qualifyingJson || [];
  const sprints = sprintJson || [];
  const completedRounds = results
    .map((race) => Number(race.round))
    .filter((round) => Number.isFinite(round) && round > 0)
    .sort((a, b) => a - b);

  const driverStandingsByRound = new Map();
  const constructorStandingsByRound = new Map();
  for (const round of completedRounds) {
    const driverPayload = await fetchJson(`${API_BASE}/${season}/${round}/driverStandings.json`);
    const constructorPayload = await fetchJson(`${API_BASE}/${season}/${round}/constructorStandings.json`);
    driverStandingsByRound.set(
      round,
      driverPayload?.MRData?.StandingsTable?.StandingsLists?.[0]
        ?.DriverStandings || []
    );
    constructorStandingsByRound.set(
      round,
      constructorPayload?.MRData?.StandingsTable?.StandingsLists?.[0]
        ?.ConstructorStandings || []
    );
  }

  return {
    results,
    qualifying,
    sprints,
    completedRounds,
    driverStandingsByRound,
    constructorStandingsByRound,
    driverOfTheDayByRound: parseDriverOfTheDayByRound(dotdHtml, results, roster.drivers || [])
  };
}

function getRoundName(data, races, roundNumber) {
  const race = data.results.find((row) => Number(row.round) === Number(roundNumber));
  return (
    resolveConfiguredRaceName(race?.raceName, races || []) ||
    String(race?.raceName || `Round ${roundNumber}`).trim()
  );
}

function loadExistingActuals(db) {
  return db
    .prepare("SELECT question_id, value FROM actuals")
    .all()
    .reduce((acc, row) => {
      acc[row.question_id] = row.value;
      return acc;
    }, {});
}

function ensureActualsSchema(db) {
  if (db.dialect === "postgres") {
    ensurePostgresSchema(db);
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS actuals (
      question_id TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS actual_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season INTEGER NOT NULL,
      round_number INTEGER,
      round_name TEXT,
      label TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_by_user_id INTEGER,
      review_status TEXT NOT NULL DEFAULT 'reviewed',
      reviewed_at TEXT,
      reviewed_by_user_id INTEGER,
      FOREIGN KEY(created_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS actual_snapshot_values (
      snapshot_id INTEGER NOT NULL,
      question_id TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY(snapshot_id, question_id),
      FOREIGN KEY(snapshot_id) REFERENCES actual_snapshots(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_actual_snapshots_season_round
      ON actual_snapshots(season, round_number, created_at);
    CREATE INDEX IF NOT EXISTS idx_actual_snapshot_values_snapshot
      ON actual_snapshot_values(snapshot_id);
  `);
  ensureActualSnapshotColumns(db);
}

function upsertSnapshot(db, { season, roundNumber, roundName, values, now }) {
  const existing = findLatestSnapshotForRound(db, season, roundNumber);
  const nextValues = Object.entries(values || {}).filter(([, value]) => value != null && value !== "");
  if (nextValues.length === 0) return null;

  if (existing) {
    const existingValues = fetchSnapshotValues(db, existing.id);
    const valuesChanged = !snapshotValuesEqual(existingValues, values);
    if (!valuesChanged) {
      return {
        snapshotId: Number(existing.id),
        valuesChanged: false,
        reviewStatus: normalizeReviewStatus(existing.review_status)
      };
    }
  }

  const nextReviewStatus = REVIEW_STATUS_PENDING;
  const insertSnapshot = db.prepare(
    `
    INSERT INTO actual_snapshots (
      season,
      round_number,
      round_name,
      label,
      source_type,
      source_note,
      created_at,
      updated_at,
      created_by_user_id,
      review_status,
      reviewed_at,
      reviewed_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL)
    `
  );
  const insertValue = db.prepare(
    `
    INSERT INTO actual_snapshot_values (snapshot_id, question_id, value)
    VALUES (?, ?, ?)
    `
  );
  const snapshotInfo = insertSnapshot.run(
    season,
    roundNumber,
    roundName,
    `R${roundNumber} - ${roundName}`,
    "autofill_backfill",
    BACKFILL_SOURCE_NOTE,
    now,
    now,
    nextReviewStatus
  );
  const snapshotId = Number(snapshotInfo.lastInsertRowid);
  nextValues.forEach(([questionId, value]) => {
    insertValue.run(snapshotId, questionId, value);
  });
  return {
    snapshotId,
    valuesChanged: true,
    reviewStatus: nextReviewStatus
  };
}

function writeActualsAndSnapshots(db, { season, rounds, latestValues, snapshots }) {
  const now = new Date().toISOString();
  let changedSnapshotCount = 0;
  const tx = db.transaction(() => {
    for (const snapshot of snapshots) {
      const snapshotResult = upsertSnapshot(db, {
        season,
        roundNumber: snapshot.roundNumber,
        roundName: snapshot.roundName,
        values: snapshot.values,
        now
      });
      snapshot.id = snapshotResult?.snapshotId || null;
      snapshot.valuesChanged = Boolean(snapshotResult?.valuesChanged);
      snapshot.reviewStatus = snapshotResult?.reviewStatus || REVIEW_STATUS_PENDING;
      if (snapshot.valuesChanged) changedSnapshotCount += 1;
    }

    db.prepare("DELETE FROM actuals").run();
    const insertActual = db.prepare(
      `
      INSERT INTO actuals (question_id, value, updated_at)
      VALUES (?, ?, ?)
      `
    );
    Object.entries(latestValues).forEach(([questionId, value]) => {
      insertActual.run(questionId, value, now);
    });
  });
  tx();
  return {
    updatedAt: now,
    latestRound: rounds[rounds.length - 1] || null,
    changedSnapshotCount
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const questions = readJsonFile(QUESTIONS_PATH).questions || [];
  const roster = readJsonFile(ROSTER_PATH);
  const races = readJsonFile(RACES_PATH).races || [];
  const data = await fetchSeasonData({ season: args.season, roster });
  const totalRounds = races.length;
  const completedRounds = data.completedRounds.filter((round) =>
    args.maxRound == null ? true : round <= args.maxRound
  );

  if (completedRounds.length === 0) {
    throw new Error(`No completed ${args.season} rounds found.`);
  }

  const snapshots = completedRounds.map((roundNumber) => ({
    roundNumber,
    roundName: getRoundName(data, races, roundNumber),
    values: serializedActualsForRound({
      questions,
      roster,
      races,
      data,
      roundNumber,
      totalRounds
    })
  }));

  const latestSnapshot = snapshots[snapshots.length - 1];
  let latestValues = { ...latestSnapshot.values };
  let existingActuals = {};

  if (args.apply) {
    const db = createAppDatabase({
      databaseUrl: args.databaseUrl,
      sqlitePath: args.dbPath
    });
    let result;
    try {
      if (db.dialect === "sqlite") {
        db.pragma("busy_timeout = 5000");
      }
      ensureActualsSchema(db);
      existingActuals = loadExistingActuals(db);
      latestValues = { ...existingActuals, ...latestSnapshot.values };
      result = writeActualsAndSnapshots(db, {
        season: args.season,
        rounds: completedRounds,
        latestValues,
        snapshots
      });
    } finally {
      db.close?.();
    }
    console.log(
      JSON.stringify(
        {
          mode: "apply",
          database: args.databaseUrl ? "postgres" : "sqlite",
          dbPath: args.dbPath,
          updatedAt: result.updatedAt,
          changedSnapshotCount: result.changedSnapshotCount,
          snapshots: snapshots.map((snapshot) => ({
            id: snapshot.id,
            roundNumber: snapshot.roundNumber,
            roundName: snapshot.roundName,
            valueCount: Object.keys(snapshot.values).length,
            valuesChanged: Boolean(snapshot.valuesChanged),
            reviewStatus: snapshot.reviewStatus || REVIEW_STATUS_PENDING
          })),
          latestRound: result.latestRound,
          liveActualCount: Object.keys(latestValues).length
        },
        null,
        2
      )
    );
    return;
  }

  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        database: args.databaseUrl ? "postgres" : "sqlite",
        dbPath: args.dbPath,
        completedRounds,
        cancelledRacesHandledAsZeroDnf: CANCELLED_RACES_2026,
        snapshots: snapshots.map((snapshot) => ({
          roundNumber: snapshot.roundNumber,
          roundName: snapshot.roundName,
          valueCount: Object.keys(snapshot.values).length,
          sample: {
            drivers_championship_top_3: snapshot.values.drivers_championship_top_3,
            constructors_championship_top_3: snapshot.values.constructors_championship_top_3,
            most_driver_of_the_day: snapshot.values.most_driver_of_the_day,
            mini_q5_team_engine_switch_2027_2028:
              snapshot.values.mini_q5_team_engine_switch_2027_2028,
            select_three_races_dnfs: snapshot.values.select_three_races_dnfs
          }
        })),
        latestLiveComputedValueCount: Object.keys(latestValues).length
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
