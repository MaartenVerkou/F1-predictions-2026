"use strict";

const fs = require("fs");
const path = require("path");
const {
  REVIEW_STATUS_PENDING,
  ensureActualSnapshotColumns,
  ensurePublishedActualsSchema,
  fetchSnapshotValues,
  findLatestSnapshotForRound,
  loadPublishedActuals,
  upsertSnapshotForRound
} = require("../src/actuals-snapshots");
const {
  buildEvidenceBundle,
  completeRaceDataImport,
  createRaceDataImport,
  ensureRaceDataSchema,
  linkEvidenceToActualSnapshot,
  listRaceDataSnapshots,
  saveRaceDataSnapshot,
  SOURCE_TYPES
} = require("../src/race-data-evidence");
const { createAppDatabase } = require("../src/app-database");
const { ensurePostgresSchema } = require("../src/postgres-schema");
const { resolveConfiguredRaceName } = require("../src/race-names");
const { buildPersistedDataFromEvidence } = require("../src/race-evidence-derivation");
const {
  deriveStandingsForRounds,
  DEFAULT_SCORING_RULES,
  readSeasonScoringRules
} = require("../src/season-scoring-rules");
const { buildSeasonCatalog } = require("../src/season-catalog");
const {
  fetchOpenF1SeasonData,
  PROVIDER: OPENF1_PROVIDER,
  PROVIDER_SCHEMA: OPENF1_SCHEMA
} = require("../src/openf1-provider");
const {
  assertStandardEvidenceProvider
} = require("../src/evidence-provider-policy");
const { topDamageEntities } = require("../src/destructors-damage");
const {
  computeTitleDecidedRacesBeforeEnd
} = require("../src/title-decision");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const QUESTIONS_PATH = process.env.QUESTIONS_PATH || path.join(DATA_DIR, "questions.json");
const ROSTER_PATH = process.env.ROSTER_PATH || path.join(DATA_DIR, "roster.json");
const RACES_PATH = process.env.RACES_PATH || path.join(DATA_DIR, "races.json");
const SEASON = Number(process.env.F1_SEASON || 2026);
const FORMULA1_DOTD_PATH = "awards/driver-of-the-day";
const USER_AGENT = "f1-predictions-actuals-backfill";
const BACKFILL_SOURCE_NOTE =
  "Reconstructed from OpenF1 session evidence, Formula1.com Driver of the Day, and the approved destructors source; championship points are derived from the selected season scoring rules";
const TEAM_ENGINE_SWITCH_2027_2028_ACTUAL = "no";

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
    maxRound: null,
    provider: String(process.env.F1_DATA_PROVIDER || OPENF1_PROVIDER).trim().toLowerCase()
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
    } else if (arg.startsWith("--provider=")) {
      args.provider = String(arg.slice("--provider=".length)).trim().toLowerCase();
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
  assertStandardEvidenceProvider(args.provider);
  return args;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

const SUPPORTING_FETCH_TIMEOUT_MS = 15_000;
const SUPPORTING_FETCH_RETRIES = 5;
const SUPPORTING_MAX_RETRY_AFTER_MS = 30_000;

async function fetchSupporting(url, parseResponse) {
  let lastError = null;
  for (let attempt = 0; attempt <= SUPPORTING_FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUPPORTING_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { "user-agent": USER_AGENT },
        signal: controller.signal
      });
      if (res.ok) return parseResponse(res);
      const error = new Error(`${res.status} ${res.statusText} for ${url}`);
      const retryable = [408, 425, 429, 500, 502, 503, 504].includes(res.status);
      if (!retryable || attempt >= SUPPORTING_FETCH_RETRIES) {
        error.nonRetryable = !retryable;
        throw error;
      }
      lastError = error;
      const retryAfter = Number(res.headers.get("retry-after") || 0);
      const waitMs = Math.min(
        SUPPORTING_MAX_RETRY_AFTER_MS,
        Math.max(750 * (attempt + 1), retryAfter > 0 ? retryAfter * 1000 : 0)
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    } catch (error) {
      if (error?.nonRetryable) throw error;
      lastError = error.name === "AbortError"
        ? new Error(`Timed out after ${SUPPORTING_FETCH_TIMEOUT_MS}ms for ${url}`)
        : error;
      if (attempt >= SUPPORTING_FETCH_RETRIES) throw lastError;
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error(`Failed to fetch after retries: ${url}`);
}

async function fetchJson(url) {
  return fetchSupporting(url, (res) => res.json());
}

async function fetchText(url) {
  return fetchSupporting(url, (res) => res.text());
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
  const raw = String(driver.entity || `${driver.givenName || ""} ${driver.familyName || ""}`).trim();
  return resolveCanonicalName(raw, rosterDrivers, DRIVER_NAME_ALIASES);
}

function teamNameFromApi(constructor, rosterTeams) {
  if (!constructor) return null;
  return resolveCanonicalName(String(constructor.entity || constructor.name || "").trim(), rosterTeams, TEAM_NAME_ALIASES);
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
  const base = String(raceName || "")
    .replace(/^The\s+/i, "")
    .replace(/\s+Grand Prix$/i, "")
    .trim();
  const labels = {
    Australian: "Australia",
    Chinese: "China",
    Japanese: "Japan",
    Canadian: "Canada",
    Austrian: "Austria",
    British: "Great Britain",
    Belgian: "Belgium",
    Hungarian: "Hungary",
    Dutch: "Netherlands",
    Italian: "Italy",
    Spanish: "Spain"
  };
  return labels[base] || base;
}

function parseDriverOfTheDayByRound(html, completedRaces, rosterDrivers) {
  const text = stripHtmlToText(html);
  const marker = "Salesforce Driver of the Day RESULTS";
  const start = text.indexOf(marker);
  if (start < 0) return new Map();
  const section = text.slice(start + marker.length);
  const byRound = new Map();
  let cursor = 0;

  for (let index = 0; index < completedRaces.length; index += 1) {
    const race = completedRaces[index];
    const label = shortRaceLabel(race.raceName);
    const currentMatch = section
      .slice(cursor)
      .match(new RegExp(`\\b${escapeRegExp(label)}\\b`, "i"));
    if (!currentMatch) continue;
    const currentIndex = cursor + currentMatch.index;

    let nextIndex = section.length;
    const nextSearchStart = currentIndex + label.length;
    for (let next = index + 1; next < completedRaces.length; next += 1) {
      const nextLabel = shortRaceLabel(completedRaces[next].raceName);
      const nextMatch = section
        .slice(nextSearchStart)
        .match(new RegExp(`\\b${escapeRegExp(nextLabel)}\\b`, "i"));
      if (nextMatch) {
        nextIndex = nextSearchStart + nextMatch.index;
        break;
      }
    }

    const chunk = section.slice(currentIndex, nextIndex);
    const winner = (rosterDrivers || []).find((driver) =>
      new RegExp(`\\b${escapeRegExp(driver)}\\b`, "i").test(chunk)
    );
    if (winner) byRound.set(Number(race.round), winner);
    cursor = currentIndex + label.length;
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
  const unique = Array.from(new Set(filtered.map((value) => String(value))));
  if (unique.length === 0) return null;
  if (
    MULTI_ACTUAL_SINGLE_CHOICE_IDS.has(questionId) ||
    MULTI_ACTUAL_DRIVER_FIELD_IDS.has(questionId)
  ) {
    return unique.length === 1 ? unique[0] : unique;
  }
  return unique[0];
}

function optionalNumber(value) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

function serializedActualsForRound({
  questions,
  roster,
  races,
  data,
  roundNumber,
  totalRounds,
  scoringRules = DEFAULT_SCORING_RULES
}) {
  const questionsById = Object.fromEntries((questions || []).map((question) => [question.id, question]));
  const driverStandings = data.driverStandingsByRound.get(roundNumber) || [];
  const constructorStandings = data.constructorStandingsByRound.get(roundNumber) || [];
  const completedRaces = data.results.filter((race) => Number(race.round) <= roundNumber);
  const completedQualifying = data.qualifying.filter((race) => Number(race.round) <= roundNumber);
  const completedSprints = data.sprints.filter((race) => Number(race.round) <= roundNumber);
  const completedRoundNumbers = completedRaces.map((race) => Number(race.round));

  const pointsByDriver = new Map();
  driverStandings.forEach((row) => {
    const driver = driverNameFromApi(row.Driver || row, roster.drivers || []);
    if (driver) pointsByDriver.set(driver, parseNum(row.points));
  });

  const podiumDrivers = new Set();
  const podiumTeams = new Set();
  const dnfCountsByDriver = new Map();
  const dnfByRace = Object.fromEntries(
    (Array.isArray(races) ? races : []).map((raceName) => [raceName, 0])
  );
  const raceWinnerRows = [];
  const winnerGridRows = [];
  const qualStats = new Map();
  const sprintPointsByDriver = new Map();
  // Use the full persisted calendar for sprint weekends. The selected cutoff
  // limits observed results, but must not erase known future sprint slots from
  // the maximum points still available calculation.
  const sprintRoundSet = new Set(
    (data.sprints || [])
      .filter((race) => Array.isArray(race.SprintResults) && race.SprintResults.length > 0)
      .map((race) => Number(race.round))
  );

  completedRaces.forEach((race) => {
    const raceName =
      resolveConfiguredRaceName(race.raceName, races || []) ||
      String(race.raceName || "").trim();
    const apiResults = Array.isArray(race.Results) ? race.Results : [];
    let dnfCountThisRace = 0;

    apiResults.forEach((row) => {
      const driver = driverNameFromApi(row.Driver || row, roster.drivers || []);
      const team = teamNameFromApi(row.Constructor || row, roster.teams || []);
      const position = parseNum(row.position, 0);

      if (position >= 1 && position <= 3 && driver) podiumDrivers.add(driver);
      if (position >= 1 && position <= 3 && team) podiumTeams.add(team);

      if (driver && isDnfStatus(row.status)) {
        dnfCountThisRace += 1;
        dnfCountsByDriver.set(driver, (dnfCountsByDriver.get(driver) || 0) + 1);
      }

      if (position === 1 && driver) {
        raceWinnerRows.push({ raceName, driver });
        // A missing OpenF1 starting-grid value is not grid position 0. Keep
        // it unavailable so a missing source cannot become a false tie.
        const grid = optionalNumber(row.grid);
        if (grid != null) {
          winnerGridRows.push({
            raceName,
            driver,
            grid: grid > 22 ? 23 : grid
          });
        }
      }
    });

    if (raceName) dnfByRace[raceName] = dnfCountThisRace;
  });

  completedQualifying.forEach((race) => {
    const rows = Array.isArray(race.QualifyingResults) ? race.QualifyingResults : [];
    const byTeam = new Map();
    rows.forEach((row) => {
      const team = teamNameFromApi(row.Constructor || row, roster.teams || []);
      const driver = driverNameFromApi(row.Driver || row, roster.drivers || []);
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
      const driver = driverNameFromApi(row.Driver || row, roster.drivers || []);
      if (!driver) return;
      sprintPointsByDriver.set(
        driver,
        (sprintPointsByDriver.get(driver) || 0) + parseNum(row.points, 0)
      );
    });
  });

  const mercedesEngineTeams = new Set(
    Object.entries(roster.team_profiles || {})
      .filter(([, profile]) => String(profile?.power_unit || "").trim().toLowerCase() === "mercedes")
      .map(([team]) => team)
  );
  const dotdCounts = new Map();
  completedRoundNumbers.forEach((round) => {
    const winner = data.driverOfTheDayByRound.get(round);
    if (winner) dotdCounts.set(winner, (dotdCounts.get(winner) || 0) + 1);
  });

  const firstRaceWinner = raceWinnerRows[0] || null;
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
      name: teamNameFromApi(row.Constructor || row, roster.teams || []),
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
  const currentLeader = driverNameFromApi(driverStandings[0]?.Driver || driverStandings[0], roster.drivers || []);
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
  const raceRowsByRound = completedRaces.map((race) => ({
    round: Number(race.round),
    rows: Array.isArray(race.Results) ? race.Results : []
  }));
  const damageDriverLeaders = data.destructorsByRound
    ? topDamageEntities(data.destructorsByRound, { maxRound: roundNumber, entityType: "driver" })
    : [];
  const damageTeamLeaders = data.destructorsByRound
    ? topDamageEntities(data.destructorsByRound, { maxRound: roundNumber, entityType: "team" })
    : [];

  const rawActuals = {
    drivers_championship_top_3: driverStandings
      .slice(0, 3)
      .map((row) => driverNameFromApi(row.Driver || row, roster.drivers || []))
      .filter(Boolean),
    constructors_championship_top_3: constructorStandings
      .slice(0, 3)
      .map((row) => teamNameFromApi(row.Constructor || row, roster.teams || []))
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
    destructors_driver: damageDriverLeaders.length
      ? collapseTiedActuals("destructors_driver", damageDriverLeaders)
      : null,
    destructors_team: damageTeamLeaders.length
      ? collapseTiedActuals("destructors_team", damageTeamLeaders)
      : null,
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
          (row) => teamNameFromApi(row.Constructor || row, roster.teams || []) === "Alpine"
        )?.points
      ) >
      parseNum(
        constructorStandings.find(
          (row) => teamNameFromApi(row.Constructor || row, roster.teams || []) === "Cadillac"
        )?.points
      ) +
        parseNum(
          constructorStandings.find(
            (row) => teamNameFromApi(row.Constructor || row, roster.teams || []) === "Audi"
          )?.points
        ) +
        parseNum(
          constructorStandings.find(
            (row) => teamNameFromApi(row.Constructor || row, roster.teams || []) === "Aston Martin"
          )?.points
        )
        ? "More"
        : "Less",
    select_three_races_dnfs: { dnf_by_race: dnfByRace },
    races_before_title_decided: computeTitleDecidedRacesBeforeEnd(
      {
        roundStandings,
        raceRowsByRound,
        totalRounds,
        sprintRoundSet,
        scoringRules,
        cutoffRound: roundNumber
      }
    ),
    all_teams_score_points: constructorStandings.every((row) => parseNum(row.points) > 0)
      ? "yes"
      : "no",
    mini_q1_first_race_winner_champion:
      firstRaceWinner && currentLeader && firstRaceWinner.driver === currentLeader ? "yes" : "no",
    mini_q2_mercedes_engines_top5:
      constructorStandings
        .slice(0, 5)
        .map((row) => teamNameFromApi(row.Constructor || row, roster.teams || []))
        .filter((team) => mercedesEngineTeams.has(team)).length >= 4
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

async function fetchFormula1SupportingData({ season, roster, completedRaces }) {
  const driverOfTheDayUrl =
    "https://www.formula1.com/en/results/" + season + "/" + FORMULA1_DOTD_PATH;
  const dotdHtml = await fetchText(driverOfTheDayUrl).catch(() => "");
  return {
    driverOfTheDayUrl,
    driverOfTheDayByRound: parseDriverOfTheDayByRound(
      dotdHtml,
      completedRaces || [],
      roster.drivers || []
    )
  };
}

function calendarForOpenF1(races, calendarByName = {}) {
  return (races || []).map((race, index) => {
    const name = race && typeof race === "object"
      ? String(race.name || race.raceName || "").trim()
      : String(race || "").trim();
    const configured = calendarByName?.[name] && typeof calendarByName[name] === "object"
      ? calendarByName[name]
      : {};
    return {
      ...configured,
      ...(race && typeof race === "object" ? race : {}),
      round: Number(race?.round || index + 1),
      name,
      raceName: name
    };
  });
}

async function fetchOpenF1CanonicalSeasonData({
  season,
  roster,
  races,
  calendarByName = {},
  maxRound = null,
  scoringRules = DEFAULT_SCORING_RULES
}) {
  const calendar = calendarForOpenF1(races, calendarByName);
  const sessions = await fetchOpenF1SeasonData({
    season,
    calendar,
    maxRound
  });
  const derivedStandings = deriveStandingsForRounds(
    sessions.completedRounds.map((roundNumber) => ({
      roundNumber,
      raceRows: sessions.results.find((row) => Number(row.round) === Number(roundNumber))?.Results || [],
      sprintRows: sessions.sprints.find((row) => Number(row.round) === Number(roundNumber))?.SprintResults || []
    })),
    scoringRules
  );
  const supporting = await fetchFormula1SupportingData({
    season,
    roster,
    completedRaces: sessions.results
  });
  const sourceUrlsByRound = new Map();
  sessions.completedRounds.forEach((round) => {
    const urls = { ...(sessions.sourceUrlsByRound?.get(round) || {}) };
    urls.driverOfTheDay = supporting.driverOfTheDayUrl;
    sourceUrlsByRound.set(round, urls);
  });
  return {
    ...sessions,
    ...supporting,
    driverStandingsByRound: new Map(Array.from(derivedStandings.entries()).map(([round, standings]) => [round, standings.drivers])),
    constructorStandingsByRound: new Map(Array.from(derivedStandings.entries()).map(([round, standings]) => [round, standings.constructors])),
    derivedStandingsByRound: derivedStandings,
    sourceUrlsByRound,
    provider: OPENF1_PROVIDER,
    providerSchema: OPENF1_SCHEMA,
    sourceType: SOURCE_TYPES.OPENF1,
    sourceNote: BACKFILL_SOURCE_NOTE
  };
}

async function fetchSeasonData({
  season,
  roster,
  races = [],
  calendarByName = {},
  provider = OPENF1_PROVIDER,
  maxRound = null,
  scoringRules = DEFAULT_SCORING_RULES
}) {
  assertStandardEvidenceProvider(provider);
  if (provider !== OPENF1_PROVIDER) {
    throw new Error(
      "Standard session imports require " + OPENF1_PROVIDER +
      "; " + provider + " is not a session provider."
    );
  }
  return fetchOpenF1CanonicalSeasonData({ season, roster, races, calendarByName, maxRound, scoringRules });
}

function readRunScoringRules(args) {
  let db = null;
  try {
    db = createAppDatabase({ databaseUrl: args.databaseUrl, sqlitePath: args.dbPath });
    return readSeasonScoringRules(db, args.season) || DEFAULT_SCORING_RULES;
  } catch (_error) {
    return DEFAULT_SCORING_RULES;
  } finally {
    db?.close?.();
  }
}

function getRoundName(data, races, roundNumber) {
  const race = data.results.find((row) => Number(row.round) === Number(roundNumber));
  return (
    resolveConfiguredRaceName(race?.raceName, races || []) ||
    String(race?.raceName || `Round ${roundNumber}`).trim()
  );
}

function deriveSnapshotsFromPersistedEvidence(db, {
  season,
  rounds,
  questions,
  roster,
  races,
  totalRounds,
  scoringRules = DEFAULT_SCORING_RULES
}) {
  const persistedRows = listRaceDataSnapshots(db, season);
  const data = buildPersistedDataFromEvidence(persistedRows, season, { scoringRules });
  return rounds.map((roundNumber) => ({
    roundNumber,
    roundName: getRoundName(data, races, roundNumber),
    values: serializedActualsForRound({
      questions,
      roster,
      races,
      data,
      roundNumber,
      totalRounds,
      scoringRules
    })
  }));
}

function loadExistingActuals(db, season) {
  return loadPublishedActuals(db, season).values || {};
}

function compareSnapshotValues(existingValues, derivedValues) {
  const existing = existingValues || {};
  const derived = derivedValues || {};
  const questionIds = new Set([...Object.keys(existing), ...Object.keys(derived)]);
  let changedCount = 0;
  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;
  for (const questionId of questionIds) {
    const hasExisting = Object.prototype.hasOwnProperty.call(existing, questionId);
    const hasDerived = Object.prototype.hasOwnProperty.call(derived, questionId);
    if (hasExisting && hasDerived && String(existing[questionId]) === String(derived[questionId])) {
      unchangedCount += 1;
    } else {
      changedCount += 1;
      if (!hasExisting && hasDerived) addedCount += 1;
      if (hasExisting && !hasDerived) removedCount += 1;
    }
  }
  return {
    status: existingValues == null ? "new" : changedCount > 0 ? "changed" : "unchanged",
    existingCount: Object.keys(existing).length,
    derivedCount: Object.keys(derived).length,
    unchangedCount,
    changedCount,
    addedCount,
    removedCount
  };
}

function ensureActualsSchema(db) {
  if (db.dialect === "postgres") {
    ensurePostgresSchema(db);
    ensureActualSnapshotColumns(db);
    ensurePublishedActualsSchema(db);
    ensureRaceDataSchema(db);
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
  ensurePublishedActualsSchema(db);
  ensureRaceDataSchema(db);
}

function writeActualsAndSnapshots(db, {
  season,
  rounds,
  snapshots,
  importId,
  deriveContext,
  sourceType = SOURCE_TYPES.OPENF1,
  sourceNote = BACKFILL_SOURCE_NOTE,
  parserVersion = "evidence-v1"
}) {
  const now = new Date().toISOString();
  let changedSnapshotCount = 0;
  const comparison = [];
  const tx = db.transaction(() => {
    for (const snapshot of snapshots) {
      const evidenceId = saveRaceDataSnapshot(db, {
        season,
        roundNumber: snapshot.roundNumber,
        roundName: snapshot.roundName,
        syncId: snapshot.syncId,
        importId,
        fetchedAt: snapshot.evidence?.fetchedAt || now,
        sourceType,
        sourceNote,
        parserVersion,
        calendarState: snapshot.calendarState || "completed",
        reconstructed: sourceType === SOURCE_TYPES.OPENF1,
        evidence: snapshot.evidence
      });
      snapshot.evidenceId = evidenceId;
      snapshot.importId = importId;
    }

    const derivedSnapshots = deriveSnapshotsFromPersistedEvidence(db, {
      season,
      rounds,
      ...deriveContext
    });
    const derivedByRound = new Map(derivedSnapshots.map((item) => [item.roundNumber, item]));
    for (const snapshot of snapshots) {
      const derived = derivedByRound.get(snapshot.roundNumber);
      snapshot.values = derived?.values || {};
      const existingSnapshot = findLatestSnapshotForRound(db, season, snapshot.roundNumber);
      const existingValues = existingSnapshot ? fetchSnapshotValues(db, existingSnapshot.id) : null;
      snapshot.comparison = compareSnapshotValues(existingValues, snapshot.values);
      comparison.push({
        roundNumber: snapshot.roundNumber,
        roundName: snapshot.roundName,
        ...snapshot.comparison
      });
      const snapshotResult = upsertSnapshotForRound(db, {
        season,
        roundNumber: snapshot.roundNumber,
        roundName: snapshot.roundName,
        valuesByQuestion: snapshot.values,
        sourceType,
        sourceNote,
        label: `R${snapshot.roundNumber} - ${snapshot.roundName}`,
        reviewStatus: REVIEW_STATUS_PENDING,
        preserveReviewIfUnchanged: true,
        catalogRevision: snapshot.evidence?.catalogRevision || null,
        evidenceRevision: snapshot.evidence?.payloadRevision || null,
        derivationVersion: `${parserVersion}-derivation-v2`
      });
      snapshot.id = snapshotResult?.snapshotId || null;
      linkEvidenceToActualSnapshot(db, snapshot.id, snapshot.evidenceId, importId);
      snapshot.valuesChanged = Boolean(snapshotResult?.valuesChanged);
      snapshot.reviewStatus = snapshotResult?.reviewStatus || REVIEW_STATUS_PENDING;
      if (snapshot.valuesChanged) changedSnapshotCount += 1;
    }

    completeRaceDataImport(db, importId, {
      status: "completed",
      completedRounds: snapshots.length,
      completedAt: now
    });

    // Do not publish pending derived values into the legacy global projection.
    // Admin review must explicitly promote a snapshot before public scoring can
    // consume it; the selected pending snapshot remains available in Admin.
  });
  tx();
  return {
    updatedAt: now,
    latestRound: rounds[rounds.length - 1] || null,
    changedSnapshotCount,
    comparison: {
      rounds: comparison,
      newRounds: comparison.filter((item) => item.status === "new").length,
      changedRounds: comparison.filter((item) => item.status === "changed").length,
      unchangedRounds: comparison.filter((item) => item.status === "unchanged").length,
      changedQuestionCount: comparison.reduce((total, item) => total + item.changedCount, 0)
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const questions = readJsonFile(QUESTIONS_PATH).questions || [];
  const roster = readJsonFile(ROSTER_PATH);
  const raceCatalog = readJsonFile(RACES_PATH);
  const races = raceCatalog.races || [];
  const calendarByName = raceCatalog.calendar?.[String(args.season)] || {};
  const scoringRules = readRunScoringRules(args);
  const data = await fetchSeasonData({
    season: args.season,
    roster,
    races,
    calendarByName,
    provider: args.provider,
    maxRound: args.maxRound,
    scoringRules
  });
  const sourceType = data.sourceType || args.provider;
  const sourceNote = data.sourceNote || BACKFILL_SOURCE_NOTE;
  const parserVersion = sourceType === SOURCE_TYPES.OPENF1
    ? OPENF1_SCHEMA + "-normalizer-v1"
    : "evidence-v1";
  const totalRounds = races.length;
  const completedRounds = data.completedRounds.filter((round) =>
    args.maxRound == null ? true : round <= args.maxRound
  );

  if (completedRounds.length === 0) {
    throw new Error(`No completed ${args.season} rounds found.`);
  }

  const snapshots = completedRounds.map((roundNumber) => {
    const roundName = getRoundName(data, races, roundNumber);
    return {
      roundNumber,
      roundName,
      values: serializedActualsForRound({
        questions,
        roster,
        races,
        data,
        roundNumber,
        totalRounds,
        scoringRules
      }),
      evidence: buildEvidenceBundle({
        data,
        roster,
        roundNumber,
        roundName,
        fetchedAt: new Date().toISOString(),
        sourceUrls: data.sourceUrlsByRound?.get(roundNumber) || {
          driverOfTheDay: data.driverOfTheDayUrl
        },
        provider: data.provider,
        providerSchema: data.providerSchema,
        scoringRules,
        provenance: {
          provider: data.provider,
          providerSchema: data.providerSchema,
          sourceIdentity: data.sourceIdentityByRound?.get(roundNumber) || null,
          payloadRevision: data.payloadRevisionByRound?.get(roundNumber) || null
        }
      })
    };
  });

  const latestSnapshot = snapshots[snapshots.length - 1];
  let latestValues = { ...latestSnapshot.values };
  let existingActuals = {};

  if (args.apply) {
    const db = createAppDatabase({
      databaseUrl: args.databaseUrl,
      sqlitePath: args.dbPath
    });
    let result;
    let importId = null;
    try {
      if (db.dialect === "sqlite") {
        db.pragma("busy_timeout = 5000");
      }
      ensureActualsSchema(db);
      const existingEvidenceRows = listRaceDataSnapshots(db, args.season);
      if (existingEvidenceRows.length) {
        const existingEvidenceData = buildPersistedDataFromEvidence(
          existingEvidenceRows,
          args.season,
          { scoringRules }
        );
        if (existingEvidenceData.destructorsByRound.size > 0) {
          data.destructorsByRound = existingEvidenceData.destructorsByRound;
          data.destructorsErrorsByRound = existingEvidenceData.destructorsErrorsByRound;
        }
        snapshots.forEach((snapshot) => {
          snapshot.values = serializedActualsForRound({
            questions,
            roster,
            races,
            data,
            roundNumber: snapshot.roundNumber,
            totalRounds,
            scoringRules
          });
        });
      }
      existingActuals = loadExistingActuals(db, args.season);
      const syncId = "backfill-" + args.season + "-" + Date.now();
      const seasonCatalog = buildSeasonCatalog(db, args.season, { questions });
      snapshots.forEach((snapshot) => {
        const sourceEvidence = snapshot.evidence || {};
        snapshot.evidence = buildEvidenceBundle({
          data,
          roster,
          roundNumber: snapshot.roundNumber,
          roundName: snapshot.roundName,
          fetchedAt: sourceEvidence.fetchedAt,
          sourceUrls: sourceEvidence.sourceUrls || {},
          canonicalCatalog: seasonCatalog.canonical,
          catalogRevision: seasonCatalog.catalogRevision,
          cutoffRound: snapshot.roundNumber,
          sourceIdentity: data.sourceIdentityByRound?.get(snapshot.roundNumber)
            || syncId + ":r" + snapshot.roundNumber,
          payloadRevision: data.payloadRevisionByRound?.get(snapshot.roundNumber)
            || parserVersion + ":" + snapshot.roundNumber,
          provider: data.provider,
          providerSchema: data.providerSchema,
          scoringRules,
          provenance: {
            provider: data.provider,
            providerSchema: data.providerSchema,
            sourceIdentity: data.sourceIdentityByRound?.get(snapshot.roundNumber) || null,
            payloadRevision: data.payloadRevisionByRound?.get(snapshot.roundNumber) || null
          }
        });
      });
      importId = createRaceDataImport(db, {
        season: args.season,
        syncId,
        sourceType,
        parserVersion,
        requestedRounds: completedRounds.length,
        reconstructed: sourceType === SOURCE_TYPES.OPENF1,
        sourceNote
      });
      snapshots.forEach((snapshot) => {
        snapshot.syncId = syncId;
      });
      const persistedSnapshots = snapshots.map((snapshot) => ({
        ...snapshot,
        values: undefined,
        syncId,
        calendarState: "completed"
      }));
      const derivedContext = { questions, roster, races, totalRounds, scoringRules };
      result = writeActualsAndSnapshots(db, {
        season: args.season,
        rounds: completedRounds,
        latestValues: { ...existingActuals, ...latestSnapshot.values },
        snapshots: persistedSnapshots,
        importId,
        deriveContext: derivedContext,
        sourceType,
        sourceNote,
        parserVersion
      });
      const latestDerived = persistedSnapshots.find((snapshot) => snapshot.roundNumber === (completedRounds.at(-1)));
      latestValues = { ...existingActuals, ...(latestDerived?.values || {}) };
      snapshots.splice(0, snapshots.length, ...persistedSnapshots);
    } catch (error) {
      if (importId != null) {
        completeRaceDataImport(db, importId, {
          status: "failed",
          completedRounds: 0,
          completedAt: new Date().toISOString(),
          errorMessage: error.message || String(error)
        });
      }
      throw error;
    } finally {
      db.close?.();
    }
    console.log(
      JSON.stringify(
        {
          mode: "apply",
          provider: sourceType,
          database: args.databaseUrl ? "postgres" : "sqlite",
          dbPath: args.dbPath,
          updatedAt: result.updatedAt,
          changedSnapshotCount: result.changedSnapshotCount,
          comparison: result.comparison,
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
        provider: sourceType,
        database: args.databaseUrl ? "postgres" : "sqlite",
        dbPath: args.dbPath,
        completedRounds,
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

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  buildPersistedDataFromEvidence,
  compareSnapshotValues,
  deriveSnapshotsFromPersistedEvidence,
  fetchOpenF1CanonicalSeasonData,
  fetchFormula1SupportingData,
  fetchSeasonData,
  parseArgs,
  parseDriverOfTheDayByRound,
  computeTitleDecidedRacesBeforeEnd,
  serializedActualsForRound,
  shortRaceLabel
};
