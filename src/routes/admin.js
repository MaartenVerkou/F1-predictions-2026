const crypto = require("crypto");
const bcrypt = require("bcrypt");

function registerAdminRoutes(app, deps) {
  const {
    db,
    requireAdmin,
    getCurrentUser,
    getQuestions,
    getRoster,
    getRaces,
    clampNumber,
    generateUniqueGroupId
  } = deps;
  const CURRENT_SEASON = Number(process.env.F1_SEASON || 2026);
  const CURRENT_SEASON_API_BASE = "https://api.jolpi.ca/ergast/f1";
  const CURRENT_SEASON_DOTD_RESULTS_URL = (season) =>
    `https://www.formula1.com/en/results/${Number(season)}/awards/driver-of-the-day`;
  const CURRENT_SEASON_RESULTS_URL = (season) =>
    `https://www.formula1.com/en/results/${Number(season)}/races`;
  const CURRENT_SEASON_USER_AGENT = "f1-predictions-current-actuals";
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
  const FORMULA1_RACE_SLUG_ALIASES = {
    australiangrandprix: "australia",
    chinesegrandprix: "china",
    japanesegrandprix: "japan",
    bahraingrandprix: "bahrain",
    saudiarabiangrandprix: "saudi-arabia",
    miamigrandprix: "miami",
    canadiangrandprix: "canada",
    monacograndprix: "monaco",
    barcelonacatalunyagrandprix: "barcelona-catalunya",
    austriangrandprix: "austria",
    britishgrandprix: "great-britain",
    belgiangrandprix: "belgium",
    hungariangrandprix: "hungary",
    dutchgrandprix: "netherlands",
    italiangrandprix: "italy",
    spanishgrandprix: "spain",
    azerbaijangrandprix: "azerbaijan",
    singaporegrandprix: "singapore",
    unitedstatesgrandprix: "united-states",
    mexicocitygrandprix: "mexico",
    saopaulograndprix: "brazil",
    lasvegasgrandprix: "las-vegas",
    qatargrandprix: "qatar",
    abudhabigrandprix: "abu-dhabi"
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
  const MULTI_ACTUAL_DRIVER_FIELD_IDS = new Set([
    "lowest_grid_win_position"
  ]);

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fetchJson(url, { retries = 4, baseDelayMs = 600 } = {}) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const res = await fetch(url, {
        headers: {
          "user-agent": CURRENT_SEASON_USER_AGENT
        }
      });

      if (res.ok) return res.json();

      if (res.status === 429 && attempt < retries) {
        const retryAfter = Number(res.headers.get("retry-after") || 0);
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * (attempt + 1);
        await sleep(waitMs);
        continue;
      }

      throw new Error(`${res.status} ${res.statusText} for ${url}`);
    }

    throw new Error(`Failed to fetch after retries: ${url}`);
  }

  async function fetchText(url, { retries = 4, baseDelayMs = 600 } = {}) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const res = await fetch(url, {
        headers: {
          "user-agent": CURRENT_SEASON_USER_AGENT
        }
      });

      if (res.ok) return res.text();

      if (res.status === 429 && attempt < retries) {
        const retryAfter = Number(res.headers.get("retry-after") || 0);
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * (attempt + 1);
        await sleep(waitMs);
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

  function decodeHtmlEntities(value) {
    return String(value || "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  function stripHtml(value) {
    return decodeHtmlEntities(String(value || ""))
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function resolveCanonicalName(raw, allowedValues, aliasMap = {}) {
    const key = normalizeLookupKey(raw);
    if (!key) return null;

    const aliased = aliasMap[key];
    if (aliased && (allowedValues || []).includes(aliased)) {
      return aliased;
    }

    const direct = (allowedValues || []).find(
      (value) => normalizeLookupKey(value) === key
    );
    if (direct) return direct;

    return null;
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

  function isOfficialRaceDnfStatus(statusRaw) {
    const status = String(statusRaw || "").trim().toLowerCase();
    if (!status) return false;
    return status === "dnf" || status === "retired";
  }

  function cleanOfficialDriverName(raw) {
    return String(raw || "")
      .replace(/\s+[A-Z]{3}$/, "")
      .trim();
  }

  function getFormula1RaceSlug(raceName) {
    const key = normalizeLookupKey(raceName);
    if (!key) return "";
    const aliased = FORMULA1_RACE_SLUG_ALIASES[key];
    if (aliased) return aliased;
    return key.replace(/grandprix$/, "");
  }

  function extractFormula1SeasonRaceResultUrls(html, season) {
    const hrefMatches = String(html || "").match(
      new RegExp(`/en/results/${Number(season)}/races/\\d+/[^"'\\\\\\s]+/race-result`, "g")
    ) || [];
    const bySlug = new Map();
    hrefMatches.forEach((href) => {
      const parts = href.split("/");
      const slug = String(parts[parts.length - 2] || "").trim().toLowerCase();
      if (!slug || bySlug.has(slug)) return;
      bySlug.set(slug, `https://www.formula1.com${href}`);
    });
    return bySlug;
  }

  function parseOfficialRaceResultRows(html, roster) {
    const tbodyMatch = String(html || "").match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) return [];
    const rows = [];
    const trMatches = tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
    for (const match of trMatches) {
      const cells = Array.from(
        match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi),
        (cellMatch) => stripHtml(cellMatch[1])
      );
      if (cells.length < 7) continue;
      const driver = resolveCanonicalName(
        cleanOfficialDriverName(cells[2]),
        roster.drivers || [],
        DRIVER_NAME_ALIASES
      );
      const team = resolveCanonicalName(cells[3], roster.teams || [], TEAM_NAME_ALIASES);
      rows.push({
        positionText: cells[0],
        carNumber: cells[1],
        driver,
        team,
        laps: parseNum(cells[4], 0),
        status: cells[5],
        points: parseNum(cells[6], 0)
      });
    }
    return rows;
  }

  function pickUniqueTopRow(rows, getScore) {
    const list = Array.isArray(rows) ? rows.slice() : [];
    list.sort((a, b) => {
      const diff = getScore(b) - getScore(a);
      if (diff !== 0) return diff;
      return String(a?.name || a?.team || "").localeCompare(String(b?.name || b?.team || ""));
    });
    if (list.length === 0) return null;
    const topScore = getScore(list[0]);
    const tied = list.filter((row) => getScore(row) === topScore);
    return tied.length === 1 ? tied[0] : null;
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

  function pickUniqueClosestTeam(qualStats) {
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

    if (rows.length === 0) return null;
    if (rows.length === 1) return rows[0].team;

    const first = rows[0];
    const second = rows[1];
    if (first.diff === second.diff && first.total === second.total) {
      return null;
    }
    return first.team;
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

  function computeTitleDecidedRacesBeforeEnd(roundStandings, sprintRoundSet) {
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
      for (let nextIndex = index + 1; nextIndex < ordered.length; nextIndex += 1) {
        maxRemainingPoints += maxWeekendPoints(ordered[nextIndex].round);
      }

      if (leaderPoints - secondPoints > maxRemainingPoints) {
        return ordered.length - index - 1;
      }
    }

    return 0;
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  function pickDriverOfTheDayLeadersFromOfficialResults(html, rosterDrivers) {
    const text = stripHtmlToText(html);
    if (!text) return [];

    const startToken = "Salesforce Driver of the Day RESULTS";
    const endToken = "OUR PARTNERS";
    const startIndex = text.indexOf(startToken);
    if (startIndex < 0) return [];

    const endIndex = text.indexOf(endToken, startIndex);
    const section = text
      .slice(startIndex + startToken.length, endIndex > startIndex ? endIndex : undefined)
      .trim();
    if (!section) return [];

    const counts = (rosterDrivers || [])
      .map((driver) => {
        const matches = section.match(new RegExp(`\\b${escapeRegExp(driver)}\\b`, "g"));
        return {
          name: driver,
          count: matches ? matches.length : 0
        };
      })
      .filter((row) => row.count > 0);

    return pickTopTiedRows(counts, (row) => Number(row.count || 0)).map((row) => row.name);
  }

  async function buildCurrentSeasonActualsSnapshot({ questions, roster, races, season }) {
    const safeSeason = Number.isFinite(Number(season)) ? Number(season) : CURRENT_SEASON;
    const [
      driverStandingsJson,
      constructorStandingsJson,
      resultsJson,
      qualifyingJson,
      sprintJson,
      driverOfTheDayResultsHtml,
      officialSeasonResultsHtml
    ] = await Promise.all([
      fetchJson(`${CURRENT_SEASON_API_BASE}/${safeSeason}/driverStandings.json`),
      fetchJson(`${CURRENT_SEASON_API_BASE}/${safeSeason}/constructorStandings.json`),
      fetchJson(`${CURRENT_SEASON_API_BASE}/${safeSeason}/results.json`),
      fetchJson(`${CURRENT_SEASON_API_BASE}/${safeSeason}/qualifying.json`),
      fetchJson(`${CURRENT_SEASON_API_BASE}/${safeSeason}/sprint.json`),
      fetchText(CURRENT_SEASON_DOTD_RESULTS_URL(safeSeason)).catch(() => null),
      fetchText(CURRENT_SEASON_RESULTS_URL(safeSeason)).catch(() => null)
    ]);

    const driverStandings =
      driverStandingsJson?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
    const constructorStandings =
      constructorStandingsJson?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
    const completedRaces = resultsJson?.MRData?.RaceTable?.Races || [];
    const completedQualifying = qualifyingJson?.MRData?.RaceTable?.Races || [];
    const completedSprints = sprintJson?.MRData?.RaceTable?.Races || [];

    if (driverStandings.length === 0 || constructorStandings.length === 0 || completedRaces.length === 0) {
      throw new Error(`No completed ${safeSeason} season data is available yet.`);
    }

    const pointsByDriver = new Map();
    driverStandings.forEach((row) => {
      const driver = driverNameFromApi(row.Driver, roster.drivers || []);
      if (!driver) return;
      pointsByDriver.set(driver, parseNum(row.points));
    });

    const questionsById = Object.fromEntries((questions || []).map((question) => [question.id, question]));

    const podiumDrivers = new Set();
    const podiumTeams = new Set();
    const dnfCountsByDriver = new Map();
    const dnfByRace = {};
    const winnerGridRows = [];
    const qualStats = new Map();
    const sprintPointsByDriver = new Map();
    const sprintRoundSet = new Set();
    const officialRaceUrlsBySlug = extractFormula1SeasonRaceResultUrls(
      officialSeasonResultsHtml,
      safeSeason
    );
    const officialRaceRowsByName = new Map(
      await Promise.all(
        completedRaces.map(async (race) => {
          const raceName =
            resolveCanonicalName(race.raceName, races || []) || String(race.raceName || "");
          const slug = getFormula1RaceSlug(raceName);
          const url = officialRaceUrlsBySlug.get(slug);
          if (!raceName || !url) return [raceName, null];
          try {
            const html = await fetchText(url);
            const rows = parseOfficialRaceResultRows(html, roster);
            return [raceName, rows.length > 0 ? rows : null];
          } catch (err) {
            return [raceName, null];
          }
        })
      )
    );

    completedRaces.forEach((race) => {
      const raceName = resolveCanonicalName(race.raceName, races || []) || String(race.raceName || "");
      const officialRows = officialRaceRowsByName.get(raceName);
      const apiResults = Array.isArray(race.Results) ? race.Results : [];
      let dnfCountThisRace = 0;

      if (Array.isArray(officialRows) && officialRows.length > 0) {
        officialRows.forEach((row) => {
          const position = parseNum(row.positionText, 0);

          if (position >= 1 && position <= 3 && row.driver) podiumDrivers.add(row.driver);
          if (position >= 1 && position <= 3 && row.team) podiumTeams.add(row.team);

          if (row.driver && isOfficialRaceDnfStatus(row.status)) {
            dnfCountThisRace += 1;
            dnfCountsByDriver.set(row.driver, (dnfCountsByDriver.get(row.driver) || 0) + 1);
          }
        });
      } else {
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
        });
      }

      apiResults.forEach((row) => {
        const driver = driverNameFromApi(row.Driver, roster.drivers || []);
        if (parseNum(row.position, 0) === 1 && driver) {
          const grid = parseNum(row.grid, 0);
          winnerGridRows.push({
            raceName,
            driver,
            grid: grid > 22 ? 23 : grid
          });
        }
      });

      if (raceName) {
        dnfByRace[raceName] = dnfCountThisRace;
      }
    });

    completedQualifying.forEach((race) => {
      const rows = Array.isArray(race.QualifyingResults) ? race.QualifyingResults : [];
      const byTeam = new Map();

      rows.forEach((row) => {
        const team = teamNameFromApi(row.Constructor, roster.teams || []);
        const driver = driverNameFromApi(row.Driver, roster.drivers || []);
        if (!team || !driver) return;
        if (!byTeam.has(team)) byTeam.set(team, []);
        byTeam.get(team).push({
          driver,
          position: parseNum(row.position, 999)
        });
      });

      byTeam.forEach((drivers, team) => {
        if (drivers.length < 2) return;
        const sorted = drivers
          .slice()
          .sort((a, b) => a.position - b.position)
          .slice(0, 2);

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
      if (sprintRows.length > 0) {
        sprintRoundSet.add(Number(race.round));
      }
      sprintRows.forEach((row) => {
        const driver = driverNameFromApi(row.Driver, roster.drivers || []);
        if (!driver) return;
        sprintPointsByDriver.set(
          driver,
          (sprintPointsByDriver.get(driver) || 0) + parseNum(row.points, 0)
        );
      });
    });

    const completedRounds = completedRaces
      .map((race) => Number(race.round))
      .filter((round) => Number.isFinite(round) && round > 0)
      .sort((a, b) => a - b);
    const latestCompletedRace = completedRaces
      .slice()
      .sort((a, b) => parseNum(a?.round) - parseNum(b?.round))
      .pop() || null;
    const latestRaceRound = latestCompletedRace ? parseNum(latestCompletedRace.round, 0) : 0;
    const latestRaceName = latestCompletedRace
      ? (resolveCanonicalName(latestCompletedRace.raceName, races || []) ||
        String(latestCompletedRace.raceName || "").trim())
      : "";

    const standingsByRoundJson = await Promise.all(
      completedRounds.map((round) =>
        fetchJson(`${CURRENT_SEASON_API_BASE}/${safeSeason}/${round}/driverStandings.json`)
      )
    );
    const roundStandings = standingsByRoundJson.map((payload, index) => ({
      round: completedRounds[index],
      standings:
        payload?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || []
    }));

    const currentLeader = driverNameFromApi(driverStandings[0]?.Driver, roster.drivers || []);
    const topSprintRows = Array.from(sprintPointsByDriver.entries())
      .map(([name, points]) => ({ name, points }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    const uniqueSprintLeader =
      topSprintRows.length > 0 &&
      (topSprintRows.length === 1 || topSprintRows[0].points > topSprintRows[1].points)
        ? topSprintRows[0].name
        : null;

    const firstRaceWinner = winnerGridRows[0] || null;
    const lowestGridWins = winnerGridRows
      .slice()
      .sort((a, b) => b.grid - a.grid || a.raceName.localeCompare(b.raceName));
    const lowestGridWin = lowestGridWins[0] || null;
    const lowestGridWinDrivers = lowestGridWin
      ? collapseTiedActuals(
          "lowest_grid_win_position",
          lowestGridWins
            .filter((row) => row.grid === lowestGridWin.grid)
            .map((row) => row.driver)
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
    const mostDriverOfTheDayDrivers = pickDriverOfTheDayLeadersFromOfficialResults(
      driverOfTheDayResultsHtml,
      roster.drivers || []
    );

    const autofillableActuals = {
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
          winner: left === right ? "tie" : (left > right ? pair[0] : pair[1]),
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
          winner: left === right ? "tie" : (left > right ? pair[0] : pair[1]),
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
        (
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
        )
          ? "More"
          : "Less",
      select_three_races_dnfs: {
        dnf_by_race: dnfByRace
      },
      races_before_title_decided: computeTitleDecidedRacesBeforeEnd(
        roundStandings,
        sprintRoundSet
      ),
      all_teams_score_points: constructorStandings.every(
        (row) => parseNum(row.points) > 0
      )
        ? "yes"
        : "no",
      mini_q1_first_race_winner_champion:
        firstRaceWinner && currentLeader && firstRaceWinner.driver === currentLeader
          ? "yes"
          : "no",
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
        uniqueSprintLeader && currentLeader && uniqueSprintLeader === currentLeader
          ? "yes"
          : "no"
    };

    const supportedQuestionIds = new Set(Object.keys(autofillableActuals));
    return {
      season: safeSeason,
      completedRounds: completedRounds.length,
      latestRaceRound: latestRaceRound > 0 ? latestRaceRound : null,
      latestRaceName,
      supportedQuestionIds,
      actualsByQuestion: autofillableActuals
    };
  }

  function parsePointsOverrideInput(raw, questionId) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(
        `Question "${questionId}": points override must be valid JSON (for example: 10 or {"1st":50,"2nd":25}).`
      );
    }
    const isPlainObject =
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed);
    if (typeof parsed === "number") {
      if (!Number.isFinite(parsed)) {
        throw new Error(`Question "${questionId}": points number must be finite.`);
      }
      return parsed;
    }
    if (isPlainObject) return parsed;
    throw new Error(
      `Question "${questionId}": points override must be a number or JSON object.`
    );
  }

  function withQueryParam(path, key, value) {
    const fullPath = String(path || "");
    const hashIndex = fullPath.indexOf("#");
    const basePath = hashIndex >= 0 ? fullPath.slice(0, hashIndex) : fullPath;
    const hash = hashIndex >= 0 ? fullPath.slice(hashIndex) : "";
    const separator = basePath.includes("?") ? "&" : "?";
    return `${basePath}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash}`;
  }

  function findLatestRoundSnapshotForSeason(season) {
    return db
      .prepare(
        `
        SELECT round_number, round_name
        FROM actual_snapshots
        WHERE season = ?
          AND round_number IS NOT NULL
        ORDER BY round_number DESC, created_at DESC, id DESC
        LIMIT 1
        `
      )
      .get(season);
  }

  function createActualsSnapshot({
    season,
    roundNumber = null,
    roundName = "",
    sourceType = "manual",
    sourceNote = "",
    createdByUserId = null,
    label = ""
  }) {
    const now = new Date().toISOString();
    const actualRows = db
      .prepare("SELECT question_id, value FROM actuals ORDER BY question_id ASC")
      .all();
    if (actualRows.length === 0) return null;

    const safeSeason = Number.isFinite(Number(season)) ? Number(season) : CURRENT_SEASON;
    const parsedRound = Number(roundNumber);
    const safeRoundNumber =
      Number.isFinite(parsedRound) && parsedRound > 0 ? Math.floor(parsedRound) : null;
    const safeRoundName = String(roundName || "").trim();
    const safeLabel = String(label || "").trim() || (
      safeRoundNumber
        ? `R${safeRoundNumber} - ${safeRoundName || "Snapshot"}`
        : `Manual snapshot ${now.slice(0, 10)}`
    );
    const safeSourceType = String(sourceType || "").trim() || "manual";
    const safeSourceNote = String(sourceNote || "").trim() || null;
    const safeUserId = Number.isFinite(Number(createdByUserId))
      ? Number(createdByUserId)
      : null;

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
        created_by_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    );
    const insertValue = db.prepare(
      `
      INSERT INTO actual_snapshot_values (snapshot_id, question_id, value)
      VALUES (?, ?, ?)
      `
    );

    const tx = db.transaction(() => {
      const snapshotInfo = insertSnapshot.run(
        safeSeason,
        safeRoundNumber,
        safeRoundName || null,
        safeLabel,
        safeSourceType,
        safeSourceNote,
        now,
        safeUserId
      );
      const snapshotId = Number(snapshotInfo.lastInsertRowid);
      actualRows.forEach((row) => {
        insertValue.run(snapshotId, row.question_id, row.value);
      });
      return snapshotId;
    });

    return tx();
  }

  function validatePointsOverrideType(question, parsedOverride) {
    const basePoints = question?._basePoints;
    const baseIsObject =
      basePoints &&
      typeof basePoints === "object" &&
      !Array.isArray(basePoints);
    const baseIsNumber = typeof basePoints === "number";
    const overrideIsObject =
      parsedOverride &&
      typeof parsedOverride === "object" &&
      !Array.isArray(parsedOverride);
    const overrideIsNumber = typeof parsedOverride === "number";

    if (baseIsObject && !overrideIsObject) {
      throw new Error(
        `Question "${question.id}": this question expects points as a JSON object.`
      );
    }
    if (baseIsNumber && !overrideIsNumber) {
      throw new Error(
        `Question "${question.id}": this question expects points as a number.`
      );
    }
  }

  function sourceOptionsForQuestion(question, roster, races) {
    if (question.options_source === "drivers") return roster.drivers || [];
    if (question.options_source === "teams") return roster.teams || [];
    if (question.options_source === "races") return races || [];
    return [];
  }

  function dedupeOptions(values) {
    const seen = new Set();
    const out = [];
    for (const raw of values || []) {
      const value = String(raw);
      if (!value || seen.has(value)) continue;
      seen.add(value);
      out.push(value);
    }
    return out;
  }

  function randomInt(min, max) {
    if (max <= min) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomNormal(mean = 0, stdDev = 1) {
    const u1 = Math.max(1e-12, Math.random());
    const u2 = Math.max(1e-12, Math.random());
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stdDev;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomOne(values) {
    if (!values || values.length === 0) return null;
    return values[randomInt(0, values.length - 1)];
  }

  function randomUniqueSubset(values, count) {
    const copy = [...(values || [])];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = randomInt(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, Math.max(0, Math.min(count, copy.length)));
  }

  function rankByScore(values, scoreMap, count = 1, ascending = false) {
    return [...(values || [])]
      .sort((a, b) => {
        const aScore = Number(scoreMap[a] || 0);
        const bScore = Number(scoreMap[b] || 0);
        return ascending ? aScore - bScore : bScore - aScore;
      })
      .slice(0, Math.max(1, count));
  }

  function buildPredictionModel(roster) {
    const drivers = roster?.drivers || [];
    const teams = roster?.teams || [];
    const teamBase = {
      McLaren: 95,
      Ferrari: 92,
      "Red Bull Racing": 90,
      Mercedes: 88,
      Williams: 75,
      "Aston Martin": 73,
      "Racing Bulls": 69,
      "Haas F1 Team": 66,
      Audi: 63,
      Alpine: 60,
      Cadillac: 55
    };
    const driverTeam = {
      "Max Verstappen": "Red Bull Racing",
      "Sergio Perez": "Red Bull Racing",
      "Lando Norris": "McLaren",
      "Oscar Piastri": "McLaren",
      "Charles Leclerc": "Ferrari",
      "Lewis Hamilton": "Ferrari",
      "George Russell": "Mercedes",
      "Kimi Antonelli": "Mercedes",
      "Fernando Alonso": "Aston Martin",
      "Lance Stroll": "Aston Martin",
      "Carlos Sainz Jr.": "Williams",
      "Alexander Albon": "Williams",
      "Esteban Ocon": "Haas F1 Team",
      "Oliver Bearman": "Haas F1 Team",
      "Liam Lawson": "Racing Bulls",
      "Arvid Lindblad": "Racing Bulls",
      "Pierre Gasly": "Alpine",
      "Isack Hadjar": "Alpine",
      "Nico Hulkenberg": "Audi",
      "Gabriel Bortoleto": "Audi",
      "Valtteri Bottas": "Cadillac",
      "Franco Colapinto": "Cadillac"
    };
    const driverSkill = {
      "Max Verstappen": 98,
      "Lando Norris": 95,
      "Oscar Piastri": 94,
      "Charles Leclerc": 93,
      "Lewis Hamilton": 92,
      "George Russell": 91,
      "Kimi Antonelli": 88,
      "Carlos Sainz Jr.": 86,
      "Fernando Alonso": 86,
      "Sergio Perez": 85,
      "Alexander Albon": 84,
      "Pierre Gasly": 82,
      "Esteban Ocon": 81,
      "Nico Hulkenberg": 80,
      "Liam Lawson": 79,
      "Oliver Bearman": 78,
      "Valtteri Bottas": 77,
      "Lance Stroll": 76,
      "Arvid Lindblad": 75,
      "Isack Hadjar": 74,
      "Gabriel Bortoleto": 73,
      "Franco Colapinto": 72
    };

    for (const team of teams) {
      if (!Object.prototype.hasOwnProperty.call(teamBase, team)) {
        teamBase[team] = 62;
      }
    }
    for (const driver of drivers) {
      if (!Object.prototype.hasOwnProperty.call(driverTeam, driver)) {
        driverTeam[driver] = teams[0] || "";
      }
      if (!Object.prototype.hasOwnProperty.call(driverSkill, driver)) {
        driverSkill[driver] = 75;
      }
    }

    const teamDrivers = {};
    for (const team of teams) teamDrivers[team] = [];
    for (const driver of drivers) {
      const team = driverTeam[driver];
      if (!teamDrivers[team]) teamDrivers[team] = [];
      teamDrivers[team].push(driver);
    }

    const expectedDriver = {};
    for (const driver of drivers) {
      expectedDriver[driver] =
        Number(teamBase[driverTeam[driver]] || 60) +
        Number(driverSkill[driver] || 75) * 0.45;
    }

    const expectedTeam = {};
    for (const team of teams) {
      expectedTeam[team] = (teamDrivers[team] || []).reduce(
        (sum, driver) => sum + Number(expectedDriver[driver] || 0),
        0
      );
    }

    return {
      teamBase,
      driverTeam,
      driverSkill,
      teamDrivers,
      expectedDriver,
      expectedTeam
    };
  }

  function createPredictionProfile() {
    return {
      knowledge: clamp(0.62 + randomNormal(0, 0.16), 0.2, 0.96),
      boldness: clamp(0.45 + randomNormal(0, 0.18), 0.05, 0.95)
    };
  }

  function smartAnswerForQuestion(question, roster, races, model, profile) {
    const drivers = roster.drivers || [];
    const teams = roster.teams || [];
    const options = dedupeOptions([
      ...(Array.isArray(question.options) ? question.options : []),
      ...sourceOptionsForQuestion(question, roster, races)
    ]);
    const noise = 22 * (1 - profile.knowledge) + 2;
    const pickBoolean = (priorYes) => {
      const pull = 0.55 + profile.knowledge * 0.85;
      const p = clamp(0.5 + (priorYes - 0.5) * pull + randomNormal(0, 0.06), 0.02, 0.98);
      return Math.random() < p ? "yes" : "no";
    };

    const id = question.id;
    if (id === "drivers_championship_top_3") {
      const scores = Object.fromEntries(
        drivers.map((driver) => [driver, Number(model.expectedDriver[driver] || 0) + randomNormal(0, noise)])
      );
      return rankByScore(drivers, scores, 3);
    }
    if (id === "drivers_championship_last") {
      const scores = Object.fromEntries(
        drivers.map((driver) => [driver, Number(model.expectedDriver[driver] || 0) + randomNormal(0, noise)])
      );
      return rankByScore(drivers, scores, 1, true)[0] || null;
    }
    if (id === "constructors_championship_top_3") {
      const scores = Object.fromEntries(
        teams.map((team) => [team, Number(model.expectedTeam[team] || 0) + randomNormal(0, noise * 0.8)])
      );
      return rankByScore(teams, scores, 3);
    }
    if (id === "constructors_championship_last") {
      const scores = Object.fromEntries(
        teams.map((team) => [team, Number(model.expectedTeam[team] || 0) + randomNormal(0, noise * 0.8)])
      );
      return rankByScore(teams, scores, 1, true)[0] || null;
    }
    if (id === "all_teams_score_points") return pickBoolean(0.44);
    if (id === "most_driver_of_the_day") {
      const scores = Object.fromEntries(
        drivers.map((driver) => [driver, Number(model.expectedDriver[driver] || 0) + randomNormal(0, noise * 0.55)])
      );
      return rankByScore(drivers, scores, 1)[0] || null;
    }
    if (id === "most_dnfs_driver" || id === "destructors_driver") {
      const scores = Object.fromEntries(
        drivers.map((driver) => [driver, (100 - Number(model.driverSkill[driver] || 75)) + randomNormal(0, noise * 0.7)])
      );
      return rankByScore(drivers, scores, 1)[0] || null;
    }
    if (id === "destructors_team") {
      const orderedByExpected = rankByScore(teams, model.expectedTeam, teams.length, true);
      const rankByTeam = new Map(orderedByExpected.map((team, idx) => [team, idx]));
      const lastIndex = Math.max(1, orderedByExpected.length - 1);
      const volatility = 0.08 + (1 - profile.knowledge) * 0.22 + profile.boldness * 0.1;

      const weighted = teams.map((team) => {
        const rankIndex = Number(rankByTeam.get(team) || 0);
        const rankRisk = 1 - rankIndex / lastIndex;
        const teamDrivers = model.teamDrivers[team] || [];
        const avgSkill = teamDrivers.length
          ? teamDrivers.reduce((sum, driver) => sum + Number(model.driverSkill[driver] || 75), 0) / teamDrivers.length
          : 75;
        const driverRisk = clamp((100 - avgSkill) / 28, 0.05, 1.2);
        const riskScore = clamp(
          0.62 * rankRisk + 0.38 * driverRisk + randomNormal(0, volatility),
          0.01,
          1.5
        );
        const weight = Math.max(0.01, Math.pow(riskScore, 0.9));
        return { team, weight };
      });

      const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
      if (totalWeight <= 0) return randomOne(teams) || null;
      let roll = Math.random() * totalWeight;
      for (const entry of weighted) {
        roll -= entry.weight;
        if (roll <= 0) return entry.team;
      }
      return weighted[weighted.length - 1]?.team || null;
    }
    if (id === "all_podium_finishers") {
      const scores = Object.fromEntries(
        drivers.map((driver) => [driver, Number(model.expectedDriver[driver] || 0) + randomNormal(0, noise * 0.55)])
      );
      const count = clamp(Math.round(7 + profile.knowledge * 5 + randomNormal(0, 1.8)), 4, Math.min(16, drivers.length));
      return rankByScore(drivers, scores, count);
    }
    if (question.type === "teammate_battle") {
      const pair = Array.isArray(question.options) ? question.options.slice(0, 2) : [];
      if (pair.length < 2) return null;
      const left = pair[0];
      const right = pair[1];
      const baseLeft = Number(model.expectedDriver[left] || 0);
      const baseRight = Number(model.expectedDriver[right] || 0);
      const spread = Math.max(0.35, noise * 0.12);
      const leftScore = baseLeft + randomNormal(0, spread);
      const rightScore = baseRight + randomNormal(0, spread);
      const gap = Math.abs(leftScore - rightScore);
      const tieWindow = clamp(0.35 + (1 - profile.knowledge) * 0.55, 0.35, 0.9);
      const tieChance =
        gap < tieWindow
          ? clamp(0.72 - gap / (tieWindow * 1.5), 0.12, 0.72)
          : 0.06;
      const winner = Math.random() < tieChance ? "tie" : (leftScore > rightScore ? left : right);
      const diff =
        winner === "tie"
          ? 0
          : Math.max(0, Math.round(gap * 3 + randomNormal(0, noise * 0.45)));
      return { winner, diff };
    }
    if (id === "alpine_vs_cadillac_audi") {
      const alpine = Number(model.expectedTeam.Alpine || 0);
      const combined =
        Number(model.expectedTeam.Cadillac || 0) +
        Number(model.expectedTeam.Audi || 0) +
        Number(model.expectedTeam["Aston Martin"] || 0);
      const prior = alpine > combined ? 0.6 : 0.12;
      const pMore = clamp(prior + (profile.boldness - 0.5) * 0.08, 0.02, 0.95);
      return Math.random() < pMore ? "More" : "Less";
    }
    if (id === "most_points_no_podium") {
      const allPodiumLabel =
        options.find((value) => String(value).toLowerCase().includes("all teams scored a podium")) ||
        "All teams scored a podium";
      const orderedTeams = rankByScore(teams, model.expectedTeam, teams.length);
      const rankByTeam = new Map(orderedTeams.map((team, idx) => [team, idx]));
      const lastIndex = Math.max(1, orderedTeams.length - 1);
      const nonPodiumScores = Object.fromEntries(
        teams.map((team) => {
          const expected = Number(model.expectedTeam[team] || 0);
          const rankIndex = Number(rankByTeam.get(team) || 0);
          const podiumChance = clamp(0.88 - (rankIndex / lastIndex) * 0.78, 0.1, 0.88);
          const nonPodiumPotential = expected * (1 - podiumChance);
          return [team, nonPodiumPotential + randomNormal(0, noise * 0.45)];
        })
      );
      const likely = rankByScore(teams, nonPodiumScores, 1)[0] || allPodiumLabel;
      if (Math.random() < 0.03) return allPodiumLabel;
      return likely;
    }
    if (id === "race_ban") {
      const yes = pickBoolean(0.22) === "yes";
      if (!yes) return { choice: "no", driver: null };
      const riskScores = Object.fromEntries(
        drivers.map((driver) => [driver, (100 - Number(model.driverSkill[driver] || 75)) + randomNormal(0, noise * 0.7)])
      );
      return { choice: "yes", driver: rankByScore(drivers, riskScores, 1)[0] || null };
    }
    if (id === "lowest_grid_win_position") {
      const valueOptions = options.filter((value) => value != null && value !== "");
      const numeric = valueOptions
        .filter((value) => String(value).toLowerCase() !== "pitlane")
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
      const min = numeric.length ? Math.min(...numeric) : 1;
      const max = numeric.length ? Math.max(...numeric) : 22;
      const mean = 3.3 + (1 - profile.knowledge) * 2.2 + randomNormal(0, 1.7);
      const position = clamp(Math.round(mean), min, max);
      const value = Math.random() < 0.02 ? "Pitlane" : String(position);
      const driverScores = Object.fromEntries(
        drivers.map((driver) => [
          driver,
          Number(model.expectedDriver[driver] || 0) + randomNormal(0, noise * 0.65)
        ])
      );
      const driver = rankByScore(drivers, driverScores, 1)[0] || null;
      return { value, driver };
    }
    if (id === "select_three_races_dnfs") {
      const raceScores = Object.fromEntries(
        (races || []).map((race) => [
          race,
          (/monaco|singapore|azerbaijan|las vegas|sao paulo/i.test(race) ? 3 : 1) +
            randomNormal(0, (1 - profile.knowledge) * 1.2)
        ])
      );
      return rankByScore(races || [], raceScores, Math.max(1, Number(question.count) || 3));
    }
    if (id === "closest_qualifying_teammates") {
      const teamScores = {};
      for (const team of teams) {
        const pair = model.teamDrivers[team] || [];
        if (pair.length < 2) {
          teamScores[team] = -999;
          continue;
        }
        const diff = Math.abs(
          Number(model.driverSkill[pair[0]] || 75) -
            Number(model.driverSkill[pair[1]] || 75)
        );
        teamScores[team] = -diff + randomNormal(0, noise * 0.2);
      }
      return rankByScore(teams, teamScores, 1)[0] || null;
    }
    if (id === "races_before_title_decided") {
      const top2 = rankByScore(drivers, model.expectedDriver, 2);
      const lead = Math.abs(
        Number(model.expectedDriver[top2[0]] || 0) -
          Number(model.expectedDriver[top2[1]] || 0)
      );
      return clamp(Math.round(lead / 4.2 + randomNormal(0, 1.7 + (1 - profile.knowledge))), 0, 10);
    }
    if (id === "mini_q1_first_race_winner_champion") return pickBoolean(0.24);
    if (id === "mini_q2_mercedes_engines_top5") return pickBoolean(0.48);
    if (id === "mini_q3_ferrari_podium") return pickBoolean(0.66);
    if (id === "mini_q4_sprint_champion_same") return pickBoolean(0.56);
    if (id === "mini_q5_team_engine_switch_2027_2028") return pickBoolean(0.52);

    const type = question.type || "text";
    if (type === "ranking") {
      const count = Math.max(1, Number(question.count) || 3);
      if (options.length === 0) return null;
      return randomUniqueSubset(options, count);
    }
    if (type === "single_choice") return randomOne(options);
    if (type === "multi_select") {
      if (options.length === 0) return null;
      const count = randomInt(1, Math.max(1, Math.min(6, options.length)));
      return randomUniqueSubset(options, count);
    }
    if (type === "multi_select_limited") {
      if (!Array.isArray(races) || races.length === 0) return null;
      return randomUniqueSubset(races, Math.max(1, Number(question.count) || 3));
    }
    if (type === "teammate_battle") {
      const winners = dedupeOptions(question.options || []);
      if (winners.length === 0) return null;
      const tie = Math.random() < 0.1;
      return tie
        ? { winner: "tie", diff: 0 }
        : { winner: randomOne(winners), diff: randomInt(0, 220) };
    }
    if (type === "boolean_with_optional_driver") {
      const yes = Math.random() < 0.5;
      return {
        choice: yes ? "yes" : "no",
        driver: yes ? randomOne(roster.drivers || []) : null
      };
    }
    if (type === "numeric_with_driver") {
      return {
        value: randomInt(0, 30),
        driver: randomOne(roster.drivers || [])
      };
    }
    if (type === "single_choice_with_driver") {
      return {
        value: randomOne(options),
        driver: randomOne(roster.drivers || [])
      };
    }
    if (type === "boolean") return Math.random() < 0.5 ? "yes" : "no";
    if (type === "numeric") return randomInt(0, 30);
    if (type === "textarea" || type === "text") {
      return randomOne(options) || `Simulated answer ${randomInt(1, 999)}`;
    }
    return null;
  }

  function serializeAnswerForStorage(question, answerValue) {
    if (answerValue == null || answerValue === "") return null;
    const type = question.type || "text";
    if (type === "single_choice" && Array.isArray(answerValue)) {
      return JSON.stringify(answerValue);
    }
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

  function parseStoredValue(question, raw) {
    if (!raw) return null;
    const text = String(raw).trim();
    const type = question.type || "text";
    if (
      type === "ranking" ||
      type === "multi_select" ||
      type === "multi_select_limited" ||
      type === "teammate_battle" ||
      type === "boolean_with_optional_driver" ||
      type === "numeric_with_driver" ||
      type === "single_choice_with_driver"
    ) {
      try {
        return JSON.parse(raw);
      } catch (err) {
        return null;
      }
    }
    if (text.startsWith("[") || text.startsWith("{")) {
      try {
        return JSON.parse(text);
      } catch (err) {}
    }
    return raw;
  }

  function isMatch(actualValue, predictedValue) {
    if (actualValue == null || predictedValue == null) return false;
    if (Array.isArray(actualValue)) return actualValue.includes(predictedValue);
    return String(actualValue) === String(predictedValue);
  }

  function scoreQuestion(question, predictedRaw, actualRaw) {
    if (actualRaw == null || predictedRaw == null) return 0;
    const type = question.type || "text";
    if (type === "ranking") {
      const points = question.points || {};
      let score = 0;
      const positionLabels = ["1st", "2nd", "3rd", "4th", "5th"];
      const count = Number(question.count) || 3;
      for (let i = 0; i < count; i += 1) {
        const actual = actualRaw[i];
        const predicted = predictedRaw[i];
        const key = positionLabels[i] || String(i + 1);
        const value = points[key] || 0;
        if (actual == null || predicted == null) continue;
        if (Array.isArray(actual) ? actual.includes(predicted) : actual === predicted) {
          score += value;
        }
      }
      return score;
    }
    if (type === "single_choice" || type === "text") {
      if (question.special_case === "all_podiums_bonus") {
        if (String(actualRaw) === String(question.bonus_value)) {
          return String(predictedRaw) === String(question.bonus_value)
            ? Number(question.bonus_points || 0)
            : 0;
        }
      }
      return isMatch(actualRaw, predictedRaw) ? Number(question.points || 0) : 0;
    }
    if (type === "boolean") {
      return isMatch(actualRaw, predictedRaw) ? Number(question.points || 0) : 0;
    }
    if (type === "multi_select") {
      const points = Number(question.points || 0);
      const penalty = Number(question.penalty ?? points);
      const minimum = Number(question.minimum ?? 0);
      const actualSet = new Set(actualRaw || []);
      const predictedSet = new Set(predictedRaw || []);
      let correct = 0;
      let wrong = 0;
      let missing = 0;
      predictedSet.forEach((item) => {
        if (actualSet.has(item)) correct += 1;
        else wrong += 1;
      });
      actualSet.forEach((item) => {
        if (!predictedSet.has(item)) missing += 1;
      });
      const score = correct * points - (wrong + missing) * penalty;
      return Math.max(minimum, score);
    }
    if (type === "teammate_battle") {
      const base = Number(question.points || 0);
      const tieBonus = Number(question.tie_bonus || 0);
      const actualWinner = actualRaw?.winner;
      const actualDiff = Number(actualRaw?.diff);
      const predictedWinner = predictedRaw?.winner;
      const predictedDiff = Number(predictedRaw?.diff);
      if (!actualWinner) return 0;
      if (actualWinner === "tie") {
        return predictedWinner === "tie" ? tieBonus : 0;
      }
      if (predictedWinner !== actualWinner) return 0;
      if (!Number.isFinite(actualDiff) || !Number.isFinite(predictedDiff)) return 0;
      return Math.max(0, base - Math.abs(predictedDiff - actualDiff));
    }
    if (type === "boolean_with_optional_driver") {
      const base = Number(question.points || 0);
      const bonus = Number(question.bonus_points || 0);
      const actualChoice = actualRaw?.choice;
      const actualDriver = actualRaw?.driver;
      const predictedChoice = predictedRaw?.choice;
      const predictedDriver = predictedRaw?.driver;
      if (actualChoice == null || predictedChoice == null) return 0;
      let score = 0;
      if (String(actualChoice) === String(predictedChoice)) {
        score += base;
        if (
          String(actualChoice) === "yes" &&
          actualDriver &&
          String(actualDriver) === String(predictedDriver)
        ) {
          score += bonus;
        }
      }
      return score;
    }
    if (type === "numeric_with_driver" || type === "single_choice_with_driver") {
      const points = question.points || {};
      const actualValue = actualRaw?.value;
      const predictedValue = predictedRaw?.value;
      const actualDriver = actualRaw?.driver;
      const predictedDriver = predictedRaw?.driver;
      let score = 0;
      if (actualValue != null && predictedValue != null) {
        if (isMatch(actualValue, predictedValue)) {
          score += Number(points.position || 0);
        } else if (
          type === "single_choice_with_driver" &&
          question.position_nearby_points &&
          typeof question.position_nearby_points === "object"
        ) {
          const toGridNumber = (value) => {
            if (value == null) return null;
            const raw = String(value).trim().toLowerCase();
            if (!raw) return null;
            if (raw === "pitlane" || raw === "pit lane") return 23;
            const numeric = Number(raw);
            return Number.isFinite(numeric) ? numeric : null;
          };

          const actualGrid = toGridNumber(actualValue);
          const predictedGrid = toGridNumber(predictedValue);
          if (actualGrid != null && predictedGrid != null) {
            const diff = Math.abs(actualGrid - predictedGrid);
            const nearbyPoints = Number(
              question.position_nearby_points[String(diff)] || 0
            );
            if (nearbyPoints > 0) score += nearbyPoints;
          }
        }
      }
      if (actualDriver && predictedDriver && isMatch(actualDriver, predictedDriver)) {
        score += Number(points.driver || 0);
      }
      return score;
    }
    if (type === "multi_select_limited") {
      const points = Number(question.points || 0);
      const dnfByRace = actualRaw?.dnf_by_race || {};
      let total = 0;
      (predictedRaw || []).forEach((race) => {
        const count = Number(dnfByRace[race] || 0);
        total += count * points;
      });
      return total;
    }
    if (type === "numeric") {
      return Number(actualRaw) === Number(predictedRaw) ? Number(question.points || 0) : 0;
    }
    return 0;
  }

  function impactLabel(flipPercent, winnerShare) {
    if (flipPercent >= 35 || winnerShare >= 12) return "HIGH";
    if (flipPercent >= 15 || winnerShare >= 6) return "MED";
    return "LOW";
  }

  function buildLeaderboardRows({ questions, actualsMap, members, responses }) {
    const questionMap = questions.reduce((acc, q) => {
      acc[q.id] = q;
      return acc;
    }, {});
    const scoreByUser = {};

    members.forEach((member) => {
      scoreByUser[member.user_id] = {
        userId: member.user_id,
        name: member.user_name,
        total: 0,
        byQuestion: {},
        answersByQuestion: {}
      };
    });

    responses.forEach((row) => {
      const question = questionMap[row.question_id];
      if (!question) return;
      const userScore = scoreByUser[row.user_id];
      if (!userScore) return;
      const actual = parseStoredValue(question, actualsMap[question.id]);
      const predicted = parseStoredValue(question, row.answer);
      const points = scoreQuestion(question, predicted, actual);
      userScore.total += points;
      userScore.byQuestion[row.question_id] = points;
      userScore.answersByQuestion[row.question_id] = row.answer;
    });

    return Object.values(scoreByUser).sort(
      (a, b) => b.total - a.total || a.name.localeCompare(b.name)
    );
  }

  function buildGroupAnalysis(groupId, questions, actualsMap, simulatedMembers, responses) {
    let scoredQuestionCount = 0;
    for (const question of questions) {
      const actual = parseStoredValue(question, actualsMap[question.id]);
      if (actual != null) scoredQuestionCount += 1;
    }

    const ranking = buildLeaderboardRows({
      questions,
      actualsMap,
      members: simulatedMembers,
      responses
    });
    const winner = ranking[0] || null;
    const winnerTotal = Number(winner?.total || 0);

    const rows = [];
    const memberCount = ranking.length;
    for (const question of questions) {
      const actual = parseStoredValue(question, actualsMap[question.id]);
      if (actual == null) continue;
      const perUser = ranking.map((userRow) => Number(userRow.byQuestion[question.id] || 0));
      const sum = perUser.reduce((acc, value) => acc + value, 0);
      const winnerPoints = Number(winner?.byQuestion?.[question.id] || 0);
      const winnerShare = winnerTotal > 0 ? (winnerPoints / winnerTotal) * 100 : 0;
      const altTotals = ranking.map((userRow, index) => Number(userRow.total || 0) - perUser[index]);
      const topAlt = Math.max(...altTotals);
      const altWinnerIndex = altTotals.findIndex((value) => value === topAlt);
      const winnerFlips = altWinnerIndex !== 0;
      const flipPercent = winnerFlips ? 100 : 0;
      const dominance = flipPercent * 0.65 + winnerShare * 0.35;
      rows.push({
        id: question.id,
        flipPercent,
        winnerShare,
        avgWinner: winnerPoints,
        avgPlayer: memberCount > 0 ? sum / memberCount : 0,
        impact: impactLabel(flipPercent, winnerShare),
        dominance,
        winnerFlips
      });
    }

    rows.sort((a, b) => b.dominance - a.dominance || b.winnerShare - a.winnerShare);

    return {
      mode: "actuals",
      groupId,
      memberCount,
      questionCount: questions.length,
      scoredQuestionCount,
      winner,
      winnerTotal,
      rows
    };
  }

  function buildSyntheticSeasonActuals(questions, roster, races, model) {
    const drivers = roster.drivers || [];
    const teams = roster.teams || [];
    const questionById = Object.fromEntries((questions || []).map((q) => [q.id, q]));

    const driverScore = Object.fromEntries(
      drivers.map((driver) => [
        driver,
        Number(model.expectedDriver[driver] || 0) + randomNormal(0, 15)
      ])
    );
    const driverOrder = rankByScore(drivers, driverScore, drivers.length);
    const teamScore = Object.fromEntries(
      teams.map((team) => [
        team,
        (model.teamDrivers[team] || []).reduce(
          (sum, driver) => sum + Number(driverScore[driver] || 0),
          0
        )
      ])
    );
    const teamOrder = rankByScore(teams, teamScore, teams.length);

    const dnfByDriver = Object.fromEntries(
      drivers.map((driver) => [
        driver,
        Math.max(
          0,
          Math.round(
            (100 - Number(model.driverSkill[driver] || 75)) / 7.5 + randomNormal(0, 2.4)
          )
        )
      ])
    );
    const damageByDriver = Object.fromEntries(
      drivers.map((driver) => [
        driver,
        Number(dnfByDriver[driver] || 0) * (0.9 + (100 - Number(model.driverSkill[driver] || 75)) / 60) +
          Math.max(0, randomNormal(0, 1.4))
      ])
    );
    const dodByDriver = Object.fromEntries(
      drivers.map((driver) => [
        driver,
        Number(model.expectedDriver[driver] || 0) * 0.03 + randomNormal(0, 0.8)
      ])
    );

    const podiumCount = clamp(Math.round(8 + Math.random() * 6), 5, Math.min(16, drivers.length));
    const podiumSet = rankByScore(drivers, driverScore, podiumCount);
    const podiumTeamSet = new Set(podiumSet.map((driver) => model.driverTeam[driver]));
    const teamsWithoutPodium = teams.filter((team) => !podiumTeamSet.has(team));

    const dnfByRace = Object.fromEntries(
      (races || []).map((race) => [race, clamp(Math.round(2.2 + randomNormal(0, 1.4)), 0, 8)])
    );

    const pairResult = (questionId) => {
      const opts = questionById[questionId]?.options || [];
      const left = opts[0];
      const right = opts[1];
      const leftScore = Number(driverScore[left] || 0);
      const rightScore = Number(driverScore[right] || 0);
      if (leftScore === rightScore) return { winner: "tie", diff: 0 };
      return {
        winner: leftScore > rightScore ? left : right,
        diff: Math.round(Math.abs(leftScore - rightScore) * 3)
      };
    };

    const lowestGrid = clamp(Math.round(2.8 + randomNormal(0, 2.2)), 1, 22);
    const topTwo = driverOrder.slice(0, 2);
    const titleLead =
      Math.abs(
        Number(driverScore[topTwo[0]] || 0) - Number(driverScore[topTwo[1]] || 0)
      ) || 0;
    const racesBeforeTitleDecided = clamp(Math.round(titleLead / 6 + randomNormal(0, 1.8)), 0, 10);
    const ferrariDrivers = model.teamDrivers?.Ferrari || [];
    const ferrariBothPodium =
      ferrariDrivers.length >= 2 &&
      podiumSet.includes(ferrariDrivers[0]) &&
      podiumSet.includes(ferrariDrivers[1]);

    const actuals = {
      drivers_championship_top_3: driverOrder.slice(0, 3),
      drivers_championship_last: driverOrder[driverOrder.length - 1],
      constructors_championship_top_3: teamOrder.slice(0, 3),
      constructors_championship_last: teamOrder[teamOrder.length - 1],
      all_teams_score_points: Object.values(teamScore).every((value) => Number(value) > 0) ? "yes" : "no",
      most_driver_of_the_day: rankByScore(drivers, dodByDriver, 1)[0] || null,
      most_dnfs_driver: rankByScore(drivers, dnfByDriver, 1)[0] || null,
      destructors_team: rankByScore(
        teams,
        Object.fromEntries(
          teams.map((team) => [
            team,
            (model.teamDrivers[team] || []).reduce(
              (sum, driver) => sum + Number(damageByDriver[driver] || 0),
              0
            )
          ])
        ),
        1
      )[0] || null,
      destructors_driver: rankByScore(drivers, damageByDriver, 1)[0] || null,
      all_podium_finishers: podiumSet,
      teammate_battle_antonelli_russell: pairResult("teammate_battle_antonelli_russell"),
      teammate_battle_lawson_lindblad: pairResult("teammate_battle_lawson_lindblad"),
      alpine_vs_cadillac_audi:
        Number(teamScore.Alpine || 0) >
        Number(teamScore.Cadillac || 0) +
          Number(teamScore.Audi || 0) +
          Number(teamScore["Aston Martin"] || 0)
          ? "More"
          : "Less",
      most_points_no_podium: teamsWithoutPodium.length
        ? rankByScore(teamsWithoutPodium, teamScore, 1)[0]
        : "All teams scored a podium",
      race_ban:
        Math.random() < 0.22
          ? {
              choice: "yes",
              driver:
                rankByScore(
                  drivers,
                  Object.fromEntries(
                    drivers.map((driver) => [
                      driver,
                      Number(dnfByDriver[driver] || 0) +
                        (100 - Number(model.driverSkill[driver] || 75)) / 10
                    ])
                  ),
                  1
                )[0] || null
            }
          : { choice: "no", driver: null },
      lowest_grid_win_position: {
        value: Math.random() < 0.02 ? "Pitlane" : String(lowestGrid),
        driver: driverOrder[0] || null
      },
      select_three_races_dnfs: { dnf_by_race: dnfByRace },
      closest_qualifying_teammates:
        rankByScore(
          teams,
          Object.fromEntries(
            teams.map((team) => {
              const pair = model.teamDrivers[team] || [];
              if (pair.length < 2) return [team, -999];
              const diff = Math.abs(
                Number(model.driverSkill[pair[0]] || 75) -
                  Number(model.driverSkill[pair[1]] || 75)
              );
              return [team, -diff + randomNormal(0, 0.8)];
            })
          ),
          1
        )[0] || null,
      races_before_title_decided: racesBeforeTitleDecided,
      mini_q1_first_race_winner_champion: Math.random() < 0.24 ? "yes" : "no",
      mini_q2_mercedes_engines_top5: Math.random() < 0.5 ? "yes" : "no",
      mini_q3_ferrari_podium: ferrariBothPodium ? "yes" : "no",
      mini_q4_sprint_champion_same:
        Math.random() < clamp(0.42 + titleLead / 80, 0.2, 0.9) ? "yes" : "no",
      mini_q5_team_engine_switch_2027_2028: Math.random() < 0.46 ? "yes" : "no"
    };

    return actuals;
  }

  function buildMonteCarloAnalysis({
    questions,
    roster,
    races,
    playerCount,
    seasons,
    originalPlayerCount
  }) {
    const model = buildPredictionModel(roster);
    const stats = Object.fromEntries(
      (questions || []).map((q) => [
        q.id,
        {
          flipCount: 0,
          totalPointsPlayers: 0,
          totalPointsWinner: 0
        }
      ])
    );

    let totalSamples = 0;
    let totalScore = 0;
    let totalScoreSq = 0;
    let winnerScoreSum = 0;
    let scoredQuestionCount = 0;

    for (let seasonIndex = 0; seasonIndex < seasons; seasonIndex += 1) {
      const seasonActuals = buildSyntheticSeasonActuals(questions, roster, races, model);
      const totals = new Array(playerCount).fill(0);
      const perQuestionScores = Object.fromEntries(
        (questions || []).map((q) => [q.id, new Array(playerCount).fill(0)])
      );

      let seasonScoredQuestions = 0;
      for (const question of questions) {
        if (seasonActuals[question.id] != null) seasonScoredQuestions += 1;
      }
      scoredQuestionCount += seasonScoredQuestions;

      for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
        const profile = createPredictionProfile();
        for (const question of questions) {
          const actual = seasonActuals[question.id];
          if (actual == null) continue;
          const predicted = smartAnswerForQuestion(
            question,
            roster,
            races,
            model,
            profile
          );
          const points = scoreQuestion(question, predicted, actual);
          totals[playerIndex] += points;
          perQuestionScores[question.id][playerIndex] = points;
        }
        totalSamples += 1;
        totalScore += totals[playerIndex];
        totalScoreSq += totals[playerIndex] * totals[playerIndex];
      }

      const winnerIndex = totals.findIndex((value) => value === Math.max(...totals));
      winnerScoreSum += Number(totals[winnerIndex] || 0);

      for (const question of questions) {
        const actual = seasonActuals[question.id];
        if (actual == null) continue;
        const arr = perQuestionScores[question.id];
        const sum = arr.reduce((acc, value) => acc + value, 0);
        stats[question.id].totalPointsPlayers += sum;
        stats[question.id].totalPointsWinner += Number(arr[winnerIndex] || 0);

        const altTotals = totals.map((value, index) => value - Number(arr[index] || 0));
        const altWinnerIndex = altTotals.findIndex(
          (value) => value === Math.max(...altTotals)
        );
        if (altWinnerIndex !== winnerIndex) stats[question.id].flipCount += 1;
      }
    }

    const averageWinnerScore = winnerScoreSum / Math.max(1, seasons);
    const rows = questions
      .map((question) => {
        const row = stats[question.id];
        const flipPercent = (row.flipCount / Math.max(1, seasons)) * 100;
        const avgWinner = row.totalPointsWinner / Math.max(1, seasons);
        const winnerShare =
          averageWinnerScore > 0 ? (avgWinner / averageWinnerScore) * 100 : 0;
        const avgPlayer =
          row.totalPointsPlayers / Math.max(1, seasons * playerCount);
        const dominance = flipPercent * 0.65 + winnerShare * 0.35;
        return {
          id: question.id,
          flipPercent,
          winnerShare,
          avgWinner,
          avgPlayer,
          impact: impactLabel(flipPercent, winnerShare),
          dominance,
          winnerFlips: flipPercent > 0
        };
      })
      .sort((a, b) => b.dominance - a.dominance || b.winnerShare - a.winnerShare);

    const avgTotalScore = totalScore / Math.max(1, totalSamples);
    const variance =
      totalScoreSq / Math.max(1, totalSamples) - avgTotalScore * avgTotalScore;
    const stdTotalScore = Math.sqrt(Math.max(0, variance));

    return {
      mode: "sim200",
      groupId: 0,
      memberCount: playerCount,
      originalPlayerCount: originalPlayerCount || playerCount,
      questionCount: questions.length,
      scoredQuestionCount: Math.round(scoredQuestionCount / Math.max(1, seasons)),
      winner: null,
      winnerTotal: averageWinnerScore,
      seasons,
      avgTotalScore,
      stdTotalScore,
      rows
    };
  }

  function randomAnswerForQuestion(question, roster, races, model, profile) {
    const smart = smartAnswerForQuestion(question, roster, races, model, profile);
    return serializeAnswerForStorage(question, smart);
  }

  app.get("/admin/login", (req, res) => {
    if (!req.session.userId) return res.redirect("/login");
    return res.redirect("/admin/overview");
  });

  app.get("/admin/questions", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const locale = res.locals.locale || "en";
    const saveError = req.query.error ? String(req.query.error) : null;
    const saveSuccess = req.query.success ? String(req.query.success) : null;
    const questions = getQuestions(locale, {
      includeExcluded: true,
      includeMeta: true
    });
    res.render("admin_questions", {
      user,
      questions,
      saveError,
      saveSuccess
    });
  });

  app.post("/admin/questions", requireAdmin, (req, res) => {
    const questions = getQuestions("en", {
      includeExcluded: true,
      includeMeta: true
    });
    const now = new Date().toISOString();
    const upsert = db.prepare(
      `
      INSERT INTO question_settings (question_id, included, points_override, order_index, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(question_id)
      DO UPDATE SET
        included = excluded.included,
        points_override = excluded.points_override,
        order_index = excluded.order_index,
        updated_at = excluded.updated_at
      `
    );

    try {
      const tx = db.transaction(() => {
        for (const [index, question] of questions.entries()) {
          const includeKey = `${question.id}__included`;
          const pointsKey = `${question.id}__points`;
          const included = req.body[includeKey] ? 1 : 0;
          const rawOverride = String(req.body[pointsKey] || "").trim();
          let storedOverride = null;
          if (rawOverride) {
            const parsedOverride = parsePointsOverrideInput(
              rawOverride,
              question.id
            );
            validatePointsOverrideType(question, parsedOverride);
            storedOverride = JSON.stringify(parsedOverride);
          }
          upsert.run(question.id, included, storedOverride, index, now);
        }
      });
      tx();
    } catch (err) {
      return res.redirect(
        `/admin/questions?error=${encodeURIComponent(err.message)}`
      );
    }

    return res.redirect(
      `/admin/questions?success=${encodeURIComponent("Question settings saved.")}`
    );
  });

  app.post("/admin/questions/reorder", requireAdmin, (req, res) => {
    const questions = getQuestions("en", {
      includeExcluded: true,
      includeMeta: true
    });
    let questionId = String(req.body.questionId || "").trim();
    let direction = String(req.body.direction || "").trim().toLowerCase();
    if (!questionId || !direction) {
      const move = String(req.body.move || "").trim();
      if (move.includes(":")) {
        const [idPart, dirPart] = move.split(":", 2);
        questionId = String(idPart || "").trim();
        direction = String(dirPart || "").trim().toLowerCase();
      }
    }
    if (!questionId || (direction !== "up" && direction !== "down")) {
      return res.redirect(
        `/admin/questions?error=${encodeURIComponent("Invalid reorder request.")}`
      );
    }

    const index = questions.findIndex((q) => q.id === questionId);
    if (index < 0) {
      return res.redirect(
        `/admin/questions?error=${encodeURIComponent("Question not found.")}`
      );
    }
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= questions.length) {
      return res.redirect("/admin/questions");
    }

    const reordered = questions.slice();
    const current = reordered[index];
    reordered[index] = reordered[swapIndex];
    reordered[swapIndex] = current;

    const now = new Date().toISOString();
    const upsertOrder = db.prepare(
      `
      INSERT INTO question_settings (question_id, included, points_override, order_index, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(question_id)
      DO UPDATE SET
        order_index = excluded.order_index,
        updated_at = excluded.updated_at
      `
    );

    const tx = db.transaction(() => {
      for (const [orderIndex, question] of reordered.entries()) {
        const included = question._included ? 1 : 0;
        const rawOverride = String(question._pointsOverrideRaw || "").trim();
        const storedOverride = rawOverride ? rawOverride : null;
        upsertOrder.run(question.id, included, storedOverride, orderIndex, now);
      }
    });
    tx();

    return res.redirect(
      `/admin/questions?success=${encodeURIComponent("Question order updated.")}`
    );
  });

  app.get("/admin/actuals", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const locale = res.locals.locale || "en";
    const saveError = req.query.error ? String(req.query.error) : null;
    const saveSuccess = req.query.success ? String(req.query.success) : null;
    const questions = getQuestions(locale);
    const roster = getRoster();
    const races = getRaces();
    const actualRows = db.prepare("SELECT * FROM actuals").all();
    const persistedActuals = actualRows.reduce((acc, row) => {
      acc[row.question_id] = row.value;
      return acc;
    }, {});
    const draftActuals =
      req.session &&
      req.session.adminActualsDraft &&
      typeof req.session.adminActualsDraft === "object" &&
      req.session.adminActualsDraft.values &&
      typeof req.session.adminActualsDraft.values === "object"
        ? req.session.adminActualsDraft.values
        : null;
    const actuals = draftActuals || persistedActuals;

    res.render("admin_actuals", {
      user,
      questions,
      roster,
      races,
      actuals,
      hasDraft: Boolean(draftActuals),
      saveError,
      saveSuccess
    });
  });

  app.post("/admin/actuals/autofill-current-season", requireAdmin, async (req, res) => {
    try {
      const questions = getQuestions();
      const roster = getRoster();
      const races = getRaces();
      const snapshot = await buildCurrentSeasonActualsSnapshot({
        questions,
        roster,
        races,
        season: CURRENT_SEASON
      });
      const existingActuals = db
        .prepare("SELECT question_id, value FROM actuals")
        .all()
        .reduce((acc, row) => {
          acc[row.question_id] = row.value;
          return acc;
        }, {});
      const draftActuals = { ...existingActuals };

      let filledCount = 0;
      let clearedCount = 0;
      for (const question of questions) {
        if (!snapshot.supportedQuestionIds.has(question.id)) continue;
        const value = snapshot.actualsByQuestion[question.id];
        const serialized = serializeAnswerForStorage(question, value);
        if (serialized == null || serialized === "") {
          delete draftActuals[question.id];
          clearedCount += 1;
          continue;
        }
        draftActuals[question.id] = serialized;
        filledCount += 1;
      }

      if (req.session) {
        req.session.adminActualsDraft = {
          values: draftActuals,
          updatedAt: new Date().toISOString()
        };
      }

      const summary = [
        `Autofilled ${filledCount} question${filledCount === 1 ? "" : "s"} into the form`
      ];
      if (clearedCount > 0) {
        summary.push(
          `cleared ${clearedCount} unresolved field${clearedCount === 1 ? "" : "s"} in the draft`
        );
      }
      summary.push(
        `from ${snapshot.season} standings after ${snapshot.completedRounds} completed round${snapshot.completedRounds === 1 ? "" : "s"}`
      );
      if (snapshot.latestRaceName) {
        summary.push(`latest race: ${snapshot.latestRaceName}`);
      }
      summary.push("unsaved until you click Save actuals");

      const redirectTo = `/admin/actuals?success=${encodeURIComponent(summary.join(" | "))}`;
      if (req.session) {
        return req.session.save(() => res.redirect(redirectTo));
      }
      return res.redirect(redirectTo);
    } catch (err) {
      return res.redirect(
        `/admin/actuals?error=${encodeURIComponent(`Autofill failed: ${err.message}`)}`
      );
    }
  });

  app.post("/admin/actuals", requireAdmin, (req, res) => {
    const adminUser = getCurrentUser(req);
    const questions = getQuestions();
    const races = getRaces();
    const now = new Date().toISOString();
    const clearAll = db.prepare("DELETE FROM actuals");
    const upsert = db.prepare(
      `
      INSERT INTO actuals (question_id, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(question_id)
      DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `
    );

    const tx = db.transaction(() => {
      clearAll.run();
      for (const question of questions) {
        const type = question.type || "text";
        if (type === "ranking") {
          const count = Number(question.count) || 3;
          const selections = [];
          for (let i = 1; i <= count; i += 1) {
            const value = req.body[`${question.id}_${i}`];
            if (!value) continue;
            selections.push(value);
          }
          if (selections.length === 0) continue;
          upsert.run(question.id, JSON.stringify(selections), now);
          continue;
        }
        if (type === "multi_select") {
          const selected = req.body[question.id];
          if (!selected) continue;
          const selections = Array.isArray(selected) ? selected : [selected];
          upsert.run(question.id, JSON.stringify(selections), now);
          continue;
        }
        if (type === "multi_select_limited") {
          const dnfByRace = {};
          races.forEach((race, index) => {
            const value = req.body[`${question.id}_dnf_${index}`];
            const countValue = clampNumber(value, 0, 999);
            if (countValue != null) {
              dnfByRace[race] = countValue;
            }
          });
          upsert.run(question.id, JSON.stringify({ dnf_by_race: dnfByRace }), now);
          continue;
        }
        if (type === "teammate_battle") {
          const winner = req.body[`${question.id}_winner`];
          const diffRaw = req.body[`${question.id}_diff`];
          if ((!winner || winner === "") && (diffRaw === "" || diffRaw === undefined)) {
            continue;
          }
          const diff = winner === "tie" ? null : clampNumber(diffRaw, 0, 999);
          upsert.run(question.id, JSON.stringify({ winner, diff }), now);
          continue;
        }
        if (type === "boolean_with_optional_driver") {
          const choice = req.body[question.id];
          const driver = req.body[`${question.id}_driver`];
          if (!choice) continue;
          upsert.run(question.id, JSON.stringify({ choice, driver }), now);
          continue;
        }
        if (type === "numeric_with_driver") {
          const valueRaw = req.body[`${question.id}_value`];
          const driver = req.body[`${question.id}_driver`];
          if ((valueRaw === "" || valueRaw === undefined) && (!driver || driver === "")) {
            continue;
          }
          const value = clampNumber(valueRaw, 0, 999);
          upsert.run(question.id, JSON.stringify({ value, driver }), now);
          continue;
        }
        if (type === "single_choice_with_driver") {
          const value = req.body[`${question.id}_value`];
          const driverRaw = req.body[`${question.id}_driver`];
          const driverSelections = Array.isArray(driverRaw)
            ? driverRaw.filter(Boolean)
            : (driverRaw ? [driverRaw] : []);
          const driver = MULTI_ACTUAL_DRIVER_FIELD_IDS.has(question.id)
            ? (driverSelections.length <= 1 ? (driverSelections[0] || null) : driverSelections)
            : (driverSelections[0] || "");
          if ((!value || value === "") && (!driver || driver === "")) {
            continue;
          }
          upsert.run(question.id, JSON.stringify({ value, driver }), now);
          continue;
        }

        const answer = req.body[question.id];
        if (type === "single_choice" && MULTI_ACTUAL_SINGLE_CHOICE_IDS.has(question.id)) {
          if (!answer) continue;
          const selections = Array.isArray(answer) ? answer.filter(Boolean) : [answer];
          if (selections.length === 0) continue;
          upsert.run(question.id, JSON.stringify(selections), now);
          continue;
        }
        if (answer === undefined || answer === "") continue;
        if (type === "numeric") {
          const value = clampNumber(answer, 0, 999);
          if (value == null) continue;
          upsert.run(question.id, String(value), now);
          continue;
        }
        upsert.run(question.id, String(answer).trim(), now);
      }
    });
    tx();

    if (req.session) {
      delete req.session.adminActualsDraft;
    }

    let successMessage = "Actuals saved.";
    try {
      const latestRoundSnapshot = findLatestRoundSnapshotForSeason(CURRENT_SEASON);
      const archivedSnapshotId = createActualsSnapshot({
        season: CURRENT_SEASON,
        roundNumber: latestRoundSnapshot?.round_number || null,
        roundName: String(latestRoundSnapshot?.round_name || "").trim(),
        sourceType: "manual",
        sourceNote: "Manual save from admin actuals",
        createdByUserId: adminUser?.id,
        label: latestRoundSnapshot?.round_number
          ? `R${latestRoundSnapshot.round_number} - ${String(latestRoundSnapshot?.round_name || "Manual update").trim() || "Manual update"}`
          : `Manual save ${now.slice(0, 10)}`
      });
      if (archivedSnapshotId) {
        successMessage = `Actuals saved. Snapshot #${archivedSnapshotId} saved.`;
      }
    } catch (archiveErr) {
      successMessage = `Actuals saved. Snapshot archive skipped: ${archiveErr.message}`;
    }

    const redirectTo = `/admin/actuals?success=${encodeURIComponent(successMessage)}`;
    if (req.session) {
      return req.session.save(() => res.redirect(redirectTo));
    }
    return res.redirect(redirectTo);
  });

  app.get("/admin/overview", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const adminError = req.query.error ? String(req.query.error) : null;
    const adminSuccess = req.query.success ? String(req.query.success) : null;
    const groupsPerPage = 10;
    const usersPerPage = 10;
    const namedGuestProfilesPerPage = 10;
    const visitorProfilesPerPage = 10;

    const requestedGroupPage = Number(req.query.groupPage || 1);
    const currentGroupPage = Number.isFinite(requestedGroupPage) && requestedGroupPage > 0
      ? Math.floor(requestedGroupPage)
      : 1;

    const requestedUsersPage = Number(req.query.usersPage || 1);
    const currentUsersPage = Number.isFinite(requestedUsersPage) && requestedUsersPage > 0
      ? Math.floor(requestedUsersPage)
      : 1;

    const requestedNamedGuestProfilesPage = Number(req.query.namedGuestPage || 1);
    const currentNamedGuestProfilesPage =
      Number.isFinite(requestedNamedGuestProfilesPage) && requestedNamedGuestProfilesPage > 0
        ? Math.floor(requestedNamedGuestProfilesPage)
        : 1;

    const rawVisitorPage = req.query.visitorPage || req.query.guestPage || 1;
    const requestedVisitorProfilesPage = Number(rawVisitorPage);
    const currentVisitorProfilesPage =
      Number.isFinite(requestedVisitorProfilesPage) && requestedVisitorProfilesPage > 0
        ? Math.floor(requestedVisitorProfilesPage)
        : 1;

    const nowMs = Date.now();
    const sessionRevealedEmails =
      req.session &&
      req.session.adminRevealedEmails &&
      typeof req.session.adminRevealedEmails === "object"
        ? req.session.adminRevealedEmails
        : {};
    const activeRevealedEmails = {};
    for (const [userId, expiresAtRaw] of Object.entries(sessionRevealedEmails)) {
      const expiresAt = Number(expiresAtRaw);
      if (Number.isFinite(expiresAt) && expiresAt > nowMs) {
        activeRevealedEmails[userId] = expiresAt;
      }
    }
    if (req.session) {
      req.session.adminRevealedEmails = activeRevealedEmails;
    }
    const revealedEmailUserIds = Object.keys(activeRevealedEmails)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    const groupCountRow = db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM groups g
        WHERE COALESCE(g.is_simulated, 0) = 0
        `
      )
      .get();
    const totalGroups = Number(groupCountRow?.count || 0);
    const totalGroupPages = Math.max(
      1,
      Math.ceil(totalGroups / groupsPerPage)
    );
    const safeGroupPage = Math.min(currentGroupPage, totalGroupPages);
    const groupOffset = (safeGroupPage - 1) * groupsPerPage;

    const userCountRow = db
      .prepare(
        "SELECT COUNT(*) as count FROM users WHERE is_simulated = 0 AND is_admin = 0"
      )
      .get();
    const totalUsers = Number(userCountRow?.count || 0);
    const totalUserPages = Math.max(
      1,
      Math.ceil(totalUsers / usersPerPage)
    );
    const safeUsersPage = Math.min(currentUsersPage, totalUserPages);
    const usersOffset = (safeUsersPage - 1) * usersPerPage;
    const admins = db
      .prepare(
        `
        SELECT id, name, email, created_at, is_admin, COALESCE(hide_from_global, 0) as hide_from_global
        FROM users
        WHERE is_simulated = 0
          AND is_admin = 1
        ORDER BY created_at DESC
        `
      )
      .all();

    const users = db
      .prepare(
        `
        SELECT id, name, email, created_at, is_admin
        FROM users
        WHERE is_simulated = 0
          AND is_admin = 0
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(usersPerPage, usersOffset);

    const userStats = db
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM users u WHERE u.is_simulated = 0 AND u.is_admin = 0) as user_count,
          (
            SELECT COUNT(*)
            FROM responses r
            JOIN users u ON u.id = r.user_id
            JOIN groups g ON g.id = r.group_id
            WHERE u.is_simulated = 0
              AND u.is_admin = 0
              AND COALESCE(g.is_simulated, 0) = 0
          ) as response_count,
          (
            SELECT COUNT(DISTINCT r.group_id)
            FROM responses r
            JOIN users u ON u.id = r.user_id
            JOIN groups g ON g.id = r.group_id
            WHERE u.is_simulated = 0
              AND u.is_admin = 0
              AND COALESCE(g.is_simulated, 0) = 0
          ) as groups_count,
          (
            SELECT MAX(r.updated_at)
            FROM responses r
            JOIN users u ON u.id = r.user_id
            JOIN groups g ON g.id = r.group_id
            WHERE u.is_simulated = 0
              AND u.is_admin = 0
              AND COALESCE(g.is_simulated, 0) = 0
          ) as last_activity_at
        `
      )
      .get();

    const adminStats = db
      .prepare(
        `
        SELECT
          COUNT(*) as admin_count,
          (
            SELECT COUNT(*)
            FROM responses r
            JOIN users u ON u.id = r.user_id
            JOIN groups g ON g.id = r.group_id
            WHERE u.is_simulated = 0
              AND u.is_admin = 1
              AND COALESCE(g.is_simulated, 0) = 0
          ) as response_count,
          (
            SELECT COUNT(DISTINCT r.group_id)
            FROM responses r
            JOIN users u ON u.id = r.user_id
            JOIN groups g ON g.id = r.group_id
            WHERE u.is_simulated = 0
              AND u.is_admin = 1
              AND COALESCE(g.is_simulated, 0) = 0
          ) as groups_count,
          (
            SELECT MAX(r.updated_at)
            FROM responses r
            JOIN users u ON u.id = r.user_id
            JOIN groups g ON g.id = r.group_id
            WHERE u.is_simulated = 0
              AND u.is_admin = 1
              AND COALESCE(g.is_simulated, 0) = 0
          ) as last_activity_at
        FROM users
        WHERE is_simulated = 0
          AND is_admin = 1
        `
      )
      .get();

    const groups = db
      .prepare(
        `
        SELECT
          g.id,
          g.name,
          g.owner_id,
          u.name as owner_name,
          g.created_at,
          (
            SELECT COUNT(*)
            FROM group_members gm
            JOIN users um ON um.id = gm.user_id
            WHERE gm.group_id = g.id
              AND COALESCE(um.is_simulated, 0) = 0
          ) + (
            SELECT COUNT(*)
            FROM named_guest_group_members ngm
            WHERE ngm.group_id = g.id
          ) as users_count
        FROM groups g
        JOIN users u ON u.id = g.owner_id
        WHERE COALESCE(g.is_simulated, 0) = 0
        ORDER BY g.created_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(groupsPerPage, groupOffset);

    const namedGuestStats = db
      .prepare(
        `
        SELECT
          COUNT(DISTINCT gr.guest_id) as guest_count,
          COUNT(*) as response_count,
          COUNT(DISTINCT gr.group_id) as group_count,
          MAX(gr.updated_at) as last_activity_at
        FROM guest_responses gr
        JOIN named_guest_profiles ngp ON ngp.guest_id = gr.guest_id
        JOIN groups g ON g.id = gr.group_id
        WHERE COALESCE(g.is_simulated, 0) = 0
        `
      )
      .get();

    const namedGuestProfileCountRow = db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM (
          SELECT gr.guest_id
          FROM guest_responses gr
          JOIN named_guest_profiles ngp ON ngp.guest_id = gr.guest_id
          JOIN groups g ON g.id = gr.group_id
          WHERE COALESCE(g.is_simulated, 0) = 0
          GROUP BY gr.guest_id
        ) as named_guests
        `
      )
      .get();
    const totalNamedGuestProfiles = Number(namedGuestProfileCountRow?.count || 0);
    const totalNamedGuestProfilePages = Math.max(
      1,
      Math.ceil(totalNamedGuestProfiles / namedGuestProfilesPerPage)
    );
    const safeNamedGuestProfilesPage = Math.min(
      currentNamedGuestProfilesPage,
      totalNamedGuestProfilePages
    );
    const namedGuestProfilesOffset =
      (safeNamedGuestProfilesPage - 1) * namedGuestProfilesPerPage;

    const namedGuestProfiles = db
      .prepare(
        `
        SELECT
          gr.guest_id,
          MAX(ngp.display_name) as display_name,
          COUNT(*) as answers_count,
          COUNT(DISTINCT gr.group_id) as groups_count,
          COUNT(DISTINCT gr.question_id) as questions_count,
          MIN(gr.created_at) as first_seen_at,
          MAX(gr.updated_at) as last_seen_at,
          COALESCE(
            (
              SELECT g2.name
              FROM guest_responses gr2
              JOIN groups g2 ON g2.id = gr2.group_id
              WHERE gr2.guest_id = gr.guest_id
                AND COALESCE(g2.is_simulated, 0) = 0
                AND COALESCE(g2.is_global, 0) = 0
              ORDER BY gr2.updated_at DESC
              LIMIT 1
            ),
            (
              SELECT g2.name
              FROM guest_responses gr2
              JOIN groups g2 ON g2.id = gr2.group_id
              WHERE gr2.guest_id = gr.guest_id
                AND COALESCE(g2.is_simulated, 0) = 0
              ORDER BY gr2.updated_at DESC
              LIMIT 1
            )
          ) as latest_group_name
        FROM guest_responses gr
        JOIN named_guest_profiles ngp ON ngp.guest_id = gr.guest_id
        JOIN groups g ON g.id = gr.group_id
        WHERE COALESCE(g.is_simulated, 0) = 0
        GROUP BY gr.guest_id
        ORDER BY last_seen_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(namedGuestProfilesPerPage, namedGuestProfilesOffset);

    const visitorStats = db
      .prepare(
        `
        SELECT
          COUNT(DISTINCT gr.guest_id) as guest_count,
          COUNT(*) as response_count,
          COUNT(DISTINCT gr.group_id) as group_count,
          MAX(gr.updated_at) as last_activity_at
        FROM guest_responses gr
        JOIN groups g ON g.id = gr.group_id
        WHERE COALESCE(g.is_simulated, 0) = 0
          AND NOT EXISTS (
            SELECT 1
            FROM named_guest_profiles ngp
            WHERE ngp.guest_id = gr.guest_id
          )
        `
      )
      .get();

    const visitorProfileCountRow = db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM (
          SELECT gr.guest_id
          FROM guest_responses gr
          JOIN groups g ON g.id = gr.group_id
          WHERE COALESCE(g.is_simulated, 0) = 0
            AND NOT EXISTS (
              SELECT 1
              FROM named_guest_profiles ngp
              WHERE ngp.guest_id = gr.guest_id
            )
          GROUP BY gr.guest_id
        ) as visitors
        `
      )
      .get();
    const totalVisitorProfiles = Number(visitorProfileCountRow?.count || 0);
    const totalVisitorProfilePages = Math.max(
      1,
      Math.ceil(totalVisitorProfiles / visitorProfilesPerPage)
    );
    const safeVisitorProfilesPage = Math.min(
      currentVisitorProfilesPage,
      totalVisitorProfilePages
    );
    const visitorProfilesOffset = (safeVisitorProfilesPage - 1) * visitorProfilesPerPage;

    const visitorProfiles = db
      .prepare(
        `
        SELECT
          gr.guest_id,
          COUNT(*) as answers_count,
          COUNT(DISTINCT gr.group_id) as groups_count,
          COUNT(DISTINCT gr.question_id) as questions_count,
          MIN(gr.created_at) as first_seen_at,
          MAX(gr.updated_at) as last_seen_at,
          (
            SELECT g2.name
            FROM guest_responses gr2
            JOIN groups g2 ON g2.id = gr2.group_id
            WHERE gr2.guest_id = gr.guest_id
              AND COALESCE(g2.is_simulated, 0) = 0
            ORDER BY gr2.updated_at DESC
            LIMIT 1
          ) as latest_group_name
        FROM guest_responses gr
        JOIN groups g ON g.id = gr.group_id
        WHERE COALESCE(g.is_simulated, 0) = 0
          AND NOT EXISTS (
            SELECT 1
            FROM named_guest_profiles ngp
            WHERE ngp.guest_id = gr.guest_id
          )
        GROUP BY gr.guest_id
        ORDER BY last_seen_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(visitorProfilesPerPage, visitorProfilesOffset);

    res.render("admin_overview", {
      user,
      adminError,
      adminSuccess,
      revealedEmailUserIds,
      admins,
      adminStats,
      users,
      userStats,
      groups,
      currentGroupPage: safeGroupPage,
      totalGroupPages,
      groupsPerPage,
      currentUserPage: safeUsersPage,
      totalUserPages,
      usersPerPage,
      namedGuestStats,
      namedGuestProfiles,
      currentNamedGuestPage: safeNamedGuestProfilesPage,
      totalNamedGuestPages: totalNamedGuestProfilePages,
      namedGuestProfilesPerPage,
      visitorStats,
      visitorProfiles,
      currentVisitorPage: safeVisitorProfilesPage,
      totalVisitorPages: totalVisitorProfilePages,
      visitorProfilesPerPage
    });
  });

  app.get("/admin/groups/:id", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const groupId = Number(req.params.id);
    if (!groupId) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("Invalid group id.")}`
      );
    }

    const rawReturnTo = String(req.query.returnTo || "/admin/overview#admin-groups").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      ? rawReturnTo
      : "/admin/overview#admin-groups";

    const group = db
      .prepare(
        `
        SELECT
          g.id,
          g.name,
          g.owner_id,
          g.created_at,
          COALESCE(g.is_global, 0) as is_global,
          COALESCE(g.is_public, 0) as is_public,
          COALESCE(g.is_simulated, 0) as is_simulated,
          u.name as owner_name
        FROM groups g
        JOIN users u ON u.id = g.owner_id
        WHERE g.id = ?
          AND COALESCE(g.is_simulated, 0) = 0
        LIMIT 1
        `
      )
      .get(groupId);
    if (!group) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("Group not found.")}`
      );
    }

    const groupStats = db
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = ?) as member_count,
          (SELECT COUNT(*) FROM named_guest_group_members ngm WHERE ngm.group_id = ?) as named_guest_count,
          (SELECT COUNT(*) FROM responses r WHERE r.group_id = ?) as member_responses,
          (SELECT COUNT(*) FROM guest_responses gr WHERE gr.group_id = ?) as guest_responses,
          (
            SELECT COUNT(DISTINCT question_id)
            FROM (
              SELECT r.question_id as question_id
              FROM responses r
              WHERE r.group_id = ?
              UNION
              SELECT gr.question_id as question_id
              FROM guest_responses gr
              WHERE gr.group_id = ?
            ) q
          ) as questions_answered,
          (
            SELECT MAX(updated_at)
            FROM (
              SELECT r.updated_at as updated_at
              FROM responses r
              WHERE r.group_id = ?
              UNION ALL
              SELECT gr.updated_at as updated_at
              FROM guest_responses gr
              WHERE gr.group_id = ?
            ) updates
          ) as last_activity_at
        `
      )
      .get(groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId);

    const members = db
      .prepare(
        `
        SELECT id, guest_id, name, role, member_type, joined_at
        FROM (
          SELECT
            u.id AS id,
            NULL AS guest_id,
            u.name AS name,
            gm.role AS role,
            'user' AS member_type,
            gm.joined_at AS joined_at
          FROM group_members gm
          JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = ?

          UNION ALL

          SELECT
            NULL AS id,
            ngm.guest_id AS guest_id,
            ngm.display_name AS name,
            'guest' AS role,
            'named_guest' AS member_type,
            ngm.joined_at AS joined_at
          FROM named_guest_group_members ngm
          WHERE ngm.group_id = ?
        ) combined_members
        ORDER BY joined_at ASC, name COLLATE NOCASE ASC
        `
      )
      .all(groupId, groupId);

    const responses = db
      .prepare(
        `
        SELECT group_id, group_name, is_global, question_id, answer, updated_at, member_type
        FROM (
          SELECT
            r.group_id as group_id,
            g.name as group_name,
            g.is_global as is_global,
            r.question_id as question_id,
            r.answer as answer,
            r.updated_at as updated_at,
            'user' as member_type
          FROM responses r
          JOIN groups g ON g.id = r.group_id
          WHERE r.group_id = ?

          UNION ALL

          SELECT
            gr.group_id as group_id,
            g.name as group_name,
            g.is_global as is_global,
            gr.question_id as question_id,
            gr.answer as answer,
            gr.updated_at as updated_at,
            'named_guest_or_visitor' as member_type
          FROM guest_responses gr
          JOIN groups g ON g.id = gr.group_id
          WHERE gr.group_id = ?
        ) combined_responses
        ORDER BY updated_at DESC
        LIMIT 500
        `
      )
      .all(groupId, groupId);

    return res.render("admin_group_detail", {
      user,
      group,
      groupStats,
      members,
      responses,
      returnTo
    });
  });

  app.post("/admin/users/:id/reveal-email", requireAdmin, (req, res) => {
    const targetUserId = Number(req.params.id);
    const rawReturnTo = String(req.body.returnTo || "/admin/overview").trim();
    const returnTo =
      rawReturnTo.startsWith("/admin/overview")
      || rawReturnTo.startsWith("/admin/users/")
      || rawReturnTo.startsWith("/admin/groups/")
        ? rawReturnTo
        : "/admin/overview";

    if (!targetUserId) {
      return res.redirect(withQueryParam(returnTo, "error", "Invalid user id."));
    }

    const adminUser = getCurrentUser(req);
    if (!adminUser || !adminUser.id) {
      return res.redirect("/login");
    }

    const adminPassword = String(req.body.adminPassword || "");
    if (!adminPassword) {
      return res.redirect(
        withQueryParam(returnTo, "error", "Admin password is required to view email.")
      );
    }

    const adminRow = db
      .prepare("SELECT id, password_hash FROM users WHERE id = ? AND is_admin = 1")
      .get(adminUser.id);
    if (!adminRow || !adminRow.password_hash) {
      return res.redirect(
        withQueryParam(returnTo, "error", "Admin account could not be verified.")
      );
    }

    let passwordOk = false;
    try {
      passwordOk = bcrypt.compareSync(adminPassword, adminRow.password_hash);
    } catch (err) {
      passwordOk = false;
    }
    if (!passwordOk) {
      return res.redirect(withQueryParam(returnTo, "error", "Incorrect admin password."));
    }

    const target = db
      .prepare("SELECT id FROM users WHERE id = ? AND is_simulated = 0")
      .get(targetUserId);
    if (!target) {
      return res.redirect(withQueryParam(returnTo, "error", "User not found."));
    }

    const activeMap =
      req.session &&
      req.session.adminRevealedEmails &&
      typeof req.session.adminRevealedEmails === "object"
        ? req.session.adminRevealedEmails
        : {};
    activeMap[String(targetUserId)] = Date.now() + 5 * 60 * 1000;
    if (req.session) {
      req.session.adminRevealedEmails = activeMap;
    }
    return res.redirect(returnTo);
  });

  app.get("/admin/users/:id", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const targetUserId = Number(req.params.id);
    if (!targetUserId) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("Invalid user id.")}`
      );
    }

    const rawReturnTo = String(req.query.returnTo || "/admin/overview").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      || rawReturnTo.startsWith("/admin/groups/")
      ? rawReturnTo
      : "/admin/overview";

    const targetUser = db
      .prepare(
        `
        SELECT id, name, email, created_at, is_admin, is_verified, verified_at
        FROM users
        WHERE id = ?
          AND is_simulated = 0
        `
      )
      .get(targetUserId);

    if (!targetUser) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("User not found.")}`
      );
    }

    const memberships = db
      .prepare(
        `
        SELECT
          gm.group_id,
          g.name as group_name,
          g.is_global,
          gm.role,
          gm.joined_at
        FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        WHERE gm.user_id = ?
          AND COALESCE(g.is_simulated, 0) = 0
        ORDER BY gm.joined_at DESC
        `
      )
      .all(targetUserId);

    const responseStats = db
      .prepare(
        `
        SELECT
          COUNT(*) as response_count,
          COUNT(DISTINCT r.group_id) as groups_count,
          COUNT(DISTINCT r.question_id) as questions_count,
          MAX(r.updated_at) as last_updated_at
        FROM responses r
        JOIN groups g ON g.id = r.group_id
        WHERE r.user_id = ?
          AND COALESCE(g.is_simulated, 0) = 0
        `
      )
      .get(targetUserId);

    const responses = db
      .prepare(
        `
        SELECT
          r.group_id,
          g.name as group_name,
          g.is_global,
          r.question_id,
          r.answer,
          r.updated_at
        FROM responses r
        JOIN groups g ON g.id = r.group_id
        WHERE r.user_id = ?
          AND COALESCE(g.is_simulated, 0) = 0
        ORDER BY r.updated_at DESC
        LIMIT 500
        `
      )
      .all(targetUserId);

    return res.render("admin_user_detail", {
      user,
      targetUser,
      memberships,
      responses,
      responseStats,
      returnTo
    });
  });

  app.get("/admin/guests/:guestId", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const guestId = String(req.params.guestId || "").trim();
    if (!guestId || !/^[A-Za-z0-9_-]{4,128}$/.test(guestId)) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("Invalid guest id.")}`
      );
    }

    const rawReturnTo = String(req.query.returnTo || "/admin/overview").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      || rawReturnTo.startsWith("/admin/groups/")
      ? rawReturnTo
      : "/admin/overview";

    const namedGuestProfile = db
      .prepare(
        `
        SELECT guest_id, display_name, source_group_id, created_at, updated_at
        FROM named_guest_profiles
        WHERE guest_id = ?
        `
      )
      .get(guestId);

    const guestStats = db
      .prepare(
        `
        SELECT
          COUNT(*) as response_count,
          COUNT(DISTINCT gr.group_id) as groups_count,
          COUNT(DISTINCT gr.question_id) as questions_count,
          MIN(gr.created_at) as first_seen_at,
          MAX(gr.updated_at) as last_seen_at
        FROM guest_responses gr
        JOIN groups g ON g.id = gr.group_id
        WHERE gr.guest_id = ?
          AND COALESCE(g.is_simulated, 0) = 0
        `
      )
      .get(guestId);

    if (!guestStats || Number(guestStats.response_count || 0) === 0) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("Guest not found.")}`
      );
    }

    const groups = db
      .prepare(
        `
        SELECT
          gr.group_id,
          g.name as group_name,
          g.is_global,
          COUNT(*) as responses_count,
          COUNT(DISTINCT gr.question_id) as questions_count,
          MAX(gr.updated_at) as last_updated_at
        FROM guest_responses gr
        JOIN groups g ON g.id = gr.group_id
        WHERE gr.guest_id = ?
          AND COALESCE(g.is_simulated, 0) = 0
        GROUP BY gr.group_id, g.name, g.is_global
        ORDER BY last_updated_at DESC
        `
      )
      .all(guestId);

    const responses = db
      .prepare(
        `
        SELECT
          gr.group_id,
          g.name as group_name,
          g.is_global,
          gr.question_id,
          gr.answer,
          gr.updated_at
        FROM guest_responses gr
        JOIN groups g ON g.id = gr.group_id
        WHERE gr.guest_id = ?
          AND COALESCE(g.is_simulated, 0) = 0
        ORDER BY gr.updated_at DESC
        LIMIT 500
        `
      )
      .all(guestId);

    return res.render("admin_guest_detail", {
      user,
      guestId,
      namedGuestProfile,
      guestStats,
      groups,
      responses,
      returnTo
    });
  });

  app.get(["/admin/analysis", "/admin/testing"], requireAdmin, (req, res) => {
    try {
      const user = getCurrentUser(req);
      const adminError = req.query.error ? String(req.query.error) : null;
      const adminSuccess = req.query.success ? String(req.query.success) : null;
      const groupsPerPage = 10;
      const requestedPage = Number(req.query.page || 1);
      const currentPage =
        Number.isFinite(requestedPage) && requestedPage > 0
          ? Math.floor(requestedPage)
          : 1;

      const countRow = db
        .prepare(
          `
          SELECT COUNT(*) as count
          FROM groups g
          WHERE COALESCE(g.is_simulated, 0) = 1
            AND COALESCE(g.is_global, 0) = 0
          `
        )
        .get();
      const totalGroups = Number(countRow?.count || 0);
      const totalPages = Math.max(1, Math.ceil(totalGroups / groupsPerPage));
      const safePage = Math.min(currentPage, totalPages);
      const offset = (safePage - 1) * groupsPerPage;

      const groups = db
        .prepare(
          `
          SELECT
            g.id,
            g.name,
            g.created_at,
            COUNT(gm.user_id) as total_members
          FROM groups g
          LEFT JOIN group_members gm ON gm.group_id = g.id
          WHERE COALESCE(g.is_simulated, 0) = 1
            AND COALESCE(g.is_global, 0) = 0
          GROUP BY g.id, g.name, g.created_at
          ORDER BY g.created_at DESC
          LIMIT ? OFFSET ?
          `
        )
        .all(groupsPerPage, offset);

      return res.render("admin_testing", {
        user,
        adminError,
        adminSuccess,
        groups,
        groupsPerPage,
        currentPage: safePage,
        totalPages
      });
    } catch (err) {
      console.error("Admin analysis list failed:", err);
      return res.redirect(
        `/admin/analysis?error=${encodeURIComponent(`Admin analysis failed: ${err.message}`)}`
      );
    }
  });

  app.get(
    ["/admin/analysis/:groupId", "/admin/testing/:groupId/analysis"],
    requireAdmin,
    (req, res) => {
      try {
        const user = getCurrentUser(req);
        const groupId = Number(req.params.groupId);
        const mode = String(req.query.mode || "actuals").trim().toLowerCase();
        const analysisMode = mode === "sim200" ? "sim200" : "actuals";
        if (!groupId) {
          return res.redirect(
            `/admin/analysis?error=${encodeURIComponent("Invalid test group id.")}`
          );
        }

        const group = db
          .prepare(
            `
            SELECT id, name, created_at
            FROM groups
            WHERE id = ?
              AND COALESCE(is_simulated, 0) = 1
              AND COALESCE(is_global, 0) = 0
            `
          )
          .get(groupId);
        if (!group) {
          return res.redirect(
            `/admin/analysis?error=${encodeURIComponent("Test group not found.")}`
          );
        }

        const simulatedMembers = db
          .prepare(
            `
            SELECT u.id as user_id, u.name as user_name
            FROM group_members gm
            JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = ?
              AND COALESCE(u.is_simulated, 0) = 1
            ORDER BY u.id ASC
            `
          )
          .all(groupId);
        if (simulatedMembers.length === 0) {
          return res.redirect(
            `/admin/analysis?error=${encodeURIComponent(
              "This test group has no simulated players."
            )}`
          );
        }

        const responses = db
          .prepare(
            `
            SELECT r.user_id, r.question_id, r.answer
            FROM responses r
            JOIN users u ON u.id = r.user_id
            WHERE r.group_id = ?
              AND COALESCE(u.is_simulated, 0) = 1
            `
          )
          .all(groupId);

        const questions = getQuestions("en");
        const roster = getRoster();
        const races = getRaces();
        let analysis;
        if (analysisMode === "sim200") {
          const originalPlayerCount = Math.max(2, simulatedMembers.length);
          const monteCarloPlayerCount = Math.min(originalPlayerCount, 1000);
          analysis = buildMonteCarloAnalysis({
            questions,
            roster,
            races,
            playerCount: monteCarloPlayerCount,
            seasons: 200,
            originalPlayerCount
          });
        } else {
          const actualRows = db.prepare("SELECT * FROM actuals").all();
          const actualsMap = actualRows.reduce((acc, row) => {
            acc[row.question_id] = row.value;
            return acc;
          }, {});
          analysis = buildGroupAnalysis(
            groupId,
            questions,
            actualsMap,
            simulatedMembers,
            responses
          );
        }

        return res.render("admin_test_group_analysis", {
          user,
          group,
          analysis,
          analysisMode,
          questions
        });
      } catch (err) {
        console.error("Admin analysis detail failed:", err);
        return res.redirect(
          `/admin/analysis?error=${encodeURIComponent(`Analysis failed: ${err.message}`)}`
        );
      }
    }
  );

  app.get(
    ["/admin/analysis/:groupId/leaderboard", "/admin/testing/:groupId/leaderboard"],
    requireAdmin,
    (req, res) => {
      try {
        const user = getCurrentUser(req);
        const locale = res.locals.locale || "en";
        const groupId = Number(req.params.groupId);
        const mode = String(req.query.mode || "actuals").trim().toLowerCase();
        const leaderboardMode = mode === "sim200" ? "sim200" : "actuals";

        if (!groupId) {
          return res.redirect(
            `/admin/analysis?error=${encodeURIComponent("Invalid test group id.")}`
          );
        }
        if (leaderboardMode === "actuals") {
          return res.redirect(`/groups/${groupId}/leaderboard`);
        }

        const group = db
          .prepare(
            `
            SELECT id, name, created_at
            FROM groups
            WHERE id = ?
              AND COALESCE(is_simulated, 0) = 1
              AND COALESCE(is_global, 0) = 0
            `
          )
          .get(groupId);
        if (!group) {
          return res.redirect(
            `/admin/analysis?error=${encodeURIComponent("Test group not found.")}`
          );
        }

        const members = db
          .prepare(
            `
            SELECT u.id as user_id, u.name as user_name
            FROM group_members gm
            JOIN users u ON u.id = gm.user_id
            WHERE gm.group_id = ?
            ORDER BY u.name ASC
            `
          )
          .all(groupId);

        const responses = db
          .prepare(
            `
            SELECT r.user_id, r.question_id, r.answer
            FROM responses r
            WHERE r.group_id = ?
            `
          )
          .all(groupId);

        const questions = getQuestions(locale);
        const roster = getRoster();
        const races = getRaces();
        const model = buildPredictionModel(roster);
        const syntheticActuals = buildSyntheticSeasonActuals(
          questions,
          roster,
          races,
          model
        );
        const actualsMap = {};
        for (const question of questions) {
          const value = syntheticActuals[question.id];
          const raw = serializeAnswerForStorage(question, value);
          if (raw != null && raw !== "") {
            actualsMap[question.id] = raw;
          }
        }

        const fullLeaderboard = buildLeaderboardRows({
          questions,
          actualsMap,
          members,
          responses
        });

        const leaderboardPerPage = 10;
        const requestedLeaderboardPage = Number(req.query.page || 1);
        const currentLeaderboardPage =
          Number.isFinite(requestedLeaderboardPage) && requestedLeaderboardPage > 0
            ? Math.floor(requestedLeaderboardPage)
            : 1;
        const totalLeaderboardPages = Math.max(
          1,
          Math.ceil(fullLeaderboard.length / leaderboardPerPage)
        );
        const safeLeaderboardPage = Math.min(
          currentLeaderboardPage,
          totalLeaderboardPages
        );
        const leaderboardOffset = (safeLeaderboardPage - 1) * leaderboardPerPage;
        const pagedLeaderboard = fullLeaderboard
          .slice(leaderboardOffset, leaderboardOffset + leaderboardPerPage)
          .map((row, index) => ({
            ...row,
            rank: leaderboardOffset + index + 1
          }));

        return res.render("leaderboard", {
          user,
          group: {
            ...group,
            name: `${group.name} (Simulated season preview)`
          },
          questions,
          leaderboard: pagedLeaderboard,
          actuals: actualsMap,
          actualSnapshots: [],
          selectedActualSnapshotId: null,
          leaderboardTotal: fullLeaderboard.length,
          leaderboardPerPage,
          currentLeaderboardPage: safeLeaderboardPage,
          totalLeaderboardPages,
          leaderboardBasePath: `/admin/analysis/${groupId}/leaderboard`,
          leaderboardQuery: "mode=sim200"
        });
      } catch (err) {
        console.error("Admin analysis leaderboard failed:", err);
        return res.redirect(
          `/admin/analysis?error=${encodeURIComponent(`Leaderboard failed: ${err.message}`)}`
        );
      }
    }
  );

  app.post("/admin/test-group", requireAdmin, (req, res) => {
    const adminUser = getCurrentUser(req);
    if (!adminUser) return res.redirect("/login");
    const MAX_FAKE_PLAYERS = 1000;

    const now = new Date().toISOString();
    const requestedName = String(req.body.groupName || "").trim();
    const groupName =
      requestedName || `Test Group ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
    const rawCount = Number(req.body.fakePlayerCount || 0);
    if (Number.isFinite(rawCount) && rawCount > MAX_FAKE_PLAYERS) {
      return res.redirect(
        `/admin/analysis?error=${encodeURIComponent(
          `Max fake players is ${MAX_FAKE_PLAYERS} to keep analysis stable.`
        )}`
      );
    }
    const fakePlayerCount = Number.isFinite(rawCount)
      ? Math.max(1, Math.min(MAX_FAKE_PLAYERS, Math.floor(rawCount)))
      : 200;

    const questions = getQuestions("en");
    const roster = getRoster();
    const races = getRaces();
    const predictionModel = buildPredictionModel(roster);
    const sharedFakePasswordHash = bcrypt.hashSync(
      crypto.randomBytes(12).toString("hex"),
      10
    );

    const insertGroup = db.prepare(
      `
      INSERT INTO groups (
        id, name, owner_id, created_at, is_public, join_code, join_password_hash, rules_text, is_global, is_simulated
      )
      VALUES (?, ?, ?, ?, 0, NULL, NULL, ?, 0, 1)
      `
    );
    const addMembership = db.prepare(
      "INSERT OR IGNORE INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, ?, ?)"
    );
    const insertUser = db.prepare(
      `
      INSERT INTO users (name, email, password_hash, created_at, is_verified, verified_at, is_admin, is_simulated)
      VALUES (?, ?, ?, ?, 1, ?, 0, 1)
      `
    );
    const upsertResponse = db.prepare(
      `
      INSERT INTO responses (user_id, group_id, question_id, answer, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, group_id, question_id)
      DO UPDATE SET answer = excluded.answer, updated_at = excluded.updated_at
      `
    );

    let createdGroupId = 0;
    try {
      const tx = db.transaction(() => {
        const rulesText =
          `Simulation group with ${fakePlayerCount} fake players. ` +
          `Generated by admin on ${new Date().toLocaleString()} using smart prediction profiles.`;
        const groupId = generateUniqueGroupId();
        insertGroup.run(groupId, groupName, adminUser.id, now, rulesText);
        createdGroupId = Number(groupId);
        addMembership.run(adminUser.id, groupId, "owner", now);

        for (let i = 1; i <= fakePlayerCount; i += 1) {
          const token = crypto.randomBytes(3).toString("hex");
          const fakeName = `Sim ${groupId}-${i}-${token}`;
          const fakeEmail = `sim-${groupId}-${i}-${token}@example.test`;
          const userInfo = insertUser.run(
            fakeName,
            fakeEmail,
            sharedFakePasswordHash,
            now,
            now
          );
          const fakeUserId = Number(userInfo.lastInsertRowid);
          addMembership.run(fakeUserId, groupId, "member", now);
          const predictionProfile = createPredictionProfile();

          for (const question of questions) {
            const answer = randomAnswerForQuestion(
              question,
              roster,
              races,
              predictionModel,
              predictionProfile
            );
            if (answer == null || answer === "") continue;
            upsertResponse.run(
              fakeUserId,
              groupId,
              question.id,
              String(answer),
              now,
              now
            );
          }
        }
      });
      tx();
    } catch (err) {
      const message =
        err && /UNIQUE constraint failed: groups\.name/i.test(String(err.message))
          ? "Group name already exists. Choose another test group name."
          : `Failed to create test group: ${err.message}`;
      return res.redirect(
        `/admin/analysis?error=${encodeURIComponent(message)}`
      );
    }

    return res.redirect(
      `/admin/analysis?success=${encodeURIComponent(
        `Created test group "${groupName}" (#${createdGroupId}) with ${fakePlayerCount} fake players.`
      )}`
    );
  });

  app.post("/admin/users/:userId/make-admin", requireAdmin, (req, res) => {
    const userId = Number(req.params.userId);
    const rawReturnTo = String(req.body.returnTo || "/admin/overview").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      ? rawReturnTo
      : "/admin/overview";
    if (!userId) return res.redirect(returnTo);
    const target = db.prepare("SELECT id, is_admin FROM users WHERE id = ?").get(userId);
    if (!target) {
      return res.redirect(withQueryParam(returnTo, "error", "User not found."));
    }
    if (target.is_admin === 1) {
      return res.redirect(withQueryParam(returnTo, "success", "User is already an admin."));
    }
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE users SET is_admin = 1, is_verified = 1, verified_at = COALESCE(verified_at, ?) WHERE id = ?"
    ).run(now, userId);
    return res.redirect(withQueryParam(returnTo, "success", "Admin rights granted."));
  });

  app.post("/admin/users/:userId/remove-admin", requireAdmin, (req, res) => {
    const userId = Number(req.params.userId);
    const rawReturnTo = String(req.body.returnTo || "/admin/overview").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      ? rawReturnTo
      : "/admin/overview";
    if (!userId) return res.redirect(returnTo);
    const currentUser = getCurrentUser(req);
    if (currentUser && currentUser.id === userId) {
      return res.redirect(
        withQueryParam(returnTo, "error", "You cannot remove your own admin rights.")
      );
    }
    const target = db.prepare("SELECT id, is_admin FROM users WHERE id = ?").get(userId);
    if (!target) {
      return res.redirect(withQueryParam(returnTo, "error", "User not found."));
    }
    if (target.is_admin !== 1) {
      return res.redirect(withQueryParam(returnTo, "success", "User is not an admin."));
    }
    db.prepare("UPDATE users SET is_admin = 0, hide_from_global = 0 WHERE id = ?").run(userId);
    return res.redirect(withQueryParam(returnTo, "success", "Admin rights removed."));
  });

  app.post("/admin/users/:userId/hide-from-global", requireAdmin, (req, res) => {
    const userId = Number(req.params.userId);
    const rawReturnTo = String(req.body.returnTo || "/admin/overview").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      ? rawReturnTo
      : "/admin/overview";
    if (!userId) return res.redirect(withQueryParam(returnTo, "error", "Invalid user id."));

    const target = db
      .prepare("SELECT id, is_admin FROM users WHERE id = ? AND is_simulated = 0")
      .get(userId);
    if (!target) {
      return res.redirect(withQueryParam(returnTo, "error", "User not found."));
    }
    if (Number(target.is_admin) !== 1) {
      return res.redirect(withQueryParam(returnTo, "error", "Only admins can be hidden from global."));
    }

    const hideFromGlobalRaw = req.body.hideFromGlobal;
    const hideFromGlobalValue = Array.isArray(hideFromGlobalRaw)
      ? hideFromGlobalRaw[hideFromGlobalRaw.length - 1]
      : hideFromGlobalRaw;
    const hideFromGlobal = hideFromGlobalValue === "1" ? 1 : 0;
    db.prepare("UPDATE users SET hide_from_global = ? WHERE id = ?").run(hideFromGlobal, userId);
    return res.redirect(
      withQueryParam(
        returnTo,
        "success",
        hideFromGlobal === 1
          ? "Admin hidden from global responses and leaderboard."
          : "Admin shown in global responses and leaderboard."
      )
    );
  });

  app.post("/admin/users/:userId/delete", requireAdmin, (req, res) => {
    const userId = Number(req.params.userId);
    const rawReturnTo = String(req.body.returnTo || "/admin/overview").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      ? rawReturnTo
      : "/admin/overview";
    if (!userId) return res.redirect(returnTo);
    const currentUser = getCurrentUser(req);
    if (currentUser && Number(currentUser.id) === userId) {
      return res.redirect(
        withQueryParam(
          returnTo,
          "error",
          "You cannot delete your own user account from admin."
        )
      );
    }

    const target = db
      .prepare("SELECT id, name FROM users WHERE id = ?")
      .get(userId);
    if (!target) {
      return res.redirect(withQueryParam(returnTo, "error", "User not found."));
    }

    try {
      const tx = db.transaction(() => {
        const now = new Date().toISOString();
        const ownedGlobalGroups = db
          .prepare("SELECT id FROM groups WHERE owner_id = ? AND is_global = 1")
          .all(userId);

        const selectFallbackOwner = db.prepare(
          `
          SELECT gm.user_id
          FROM group_members gm
          WHERE gm.group_id = ?
            AND gm.user_id != ?
          ORDER BY gm.joined_at ASC
          LIMIT 1
          `
        );

        for (const row of ownedGlobalGroups) {
          const groupId = Number(row.id);
          let fallbackOwnerId =
            currentUser && Number(currentUser.id) !== userId
              ? Number(currentUser.id)
              : null;
          if (!fallbackOwnerId) {
            const fallback = selectFallbackOwner.get(groupId, userId);
            fallbackOwnerId = fallback ? Number(fallback.user_id) : null;
          }
          if (!fallbackOwnerId) {
            throw new Error("Cannot delete user: Global group has no fallback owner.");
          }

          db.prepare(
            "INSERT OR IGNORE INTO group_members (user_id, group_id, role, joined_at) VALUES (?, ?, 'member', ?)"
          ).run(fallbackOwnerId, groupId, now);
          db.prepare("UPDATE group_members SET role = 'owner' WHERE user_id = ? AND group_id = ?")
            .run(fallbackOwnerId, groupId);
          db.prepare("UPDATE groups SET owner_id = ? WHERE id = ?")
            .run(fallbackOwnerId, groupId);
        }

        const ownedGroups = db
          .prepare("SELECT id FROM groups WHERE owner_id = ? AND is_global = 0")
          .all(userId);
        for (const row of ownedGroups) {
          const groupId = Number(row.id);
          db.prepare("DELETE FROM responses WHERE group_id = ?").run(groupId);
          db.prepare("DELETE FROM group_members WHERE group_id = ?").run(groupId);
          db.prepare("DELETE FROM invites WHERE group_id = ?").run(groupId);
          db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);
        }

        db.prepare("DELETE FROM responses WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM group_members WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM invites WHERE created_by = ?").run(userId);
        db.prepare("DELETE FROM email_verifications WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM users WHERE id = ?").run(userId);
      });
      tx();
    } catch (err) {
      return res.redirect(
        withQueryParam(returnTo, "error", `Failed to delete user: ${err.message}`)
      );
    }

    return res.redirect(withQueryParam(returnTo, "success", `User "${target.name}" deleted.`));
  });

  app.post("/admin/guests/:guestId/delete", requireAdmin, (req, res) => {
    const guestId = String(req.params.guestId || "").trim();
    const rawReturnTo = String(req.body.returnTo || "/admin/overview").trim();
    const returnTo = rawReturnTo.startsWith("/admin/overview")
      ? rawReturnTo
      : "/admin/overview";
    if (!guestId || !/^[A-Za-z0-9_-]{4,128}$/.test(guestId)) {
      return res.redirect(withQueryParam(returnTo, "error", "Invalid guest id."));
    }

    const namedGuest = db
      .prepare(
        `
        SELECT guest_id, display_name
        FROM named_guest_profiles
        WHERE guest_id = ?
        `
      )
      .get(guestId);
    const hasResponses = db
      .prepare("SELECT 1 FROM guest_responses WHERE guest_id = ? LIMIT 1")
      .get(guestId);
    const hasMemberships = db
      .prepare("SELECT 1 FROM named_guest_group_members WHERE guest_id = ? LIMIT 1")
      .get(guestId);
    if (!namedGuest && !hasResponses && !hasMemberships) {
      return res.redirect(withQueryParam(returnTo, "error", "Guest not found."));
    }

    const tx = db.transaction(() => {
      db.prepare("DELETE FROM guest_responses WHERE guest_id = ?").run(guestId);
      db.prepare("DELETE FROM named_guest_group_members WHERE guest_id = ?").run(guestId);
      db.prepare("DELETE FROM named_guest_profiles WHERE guest_id = ?").run(guestId);
      db.prepare("DELETE FROM pending_guest_claims WHERE guest_id = ?").run(guestId);
    });
    tx();

    const deletedLabel = namedGuest?.display_name
      ? `Guest "${namedGuest.display_name}" deleted.`
      : "Guest deleted.";
    return res.redirect(withQueryParam(returnTo, "success", deletedLabel));
  });

  app.post("/admin/groups/:groupId/delete", requireAdmin, (req, res) => {
    const source = String(req.query.from || "").trim().toLowerCase();
    const fallbackRedirectPath =
      source === "testing" || source === "analysis"
        ? "/admin/analysis"
        : "/admin/overview";
    const rawReturnTo = String(req.body.returnTo || "").trim();
    const redirectPath =
      rawReturnTo.startsWith("/admin/overview")
      || rawReturnTo.startsWith("/admin/analysis")
      || rawReturnTo.startsWith("/admin/groups/")
        ? rawReturnTo
        : fallbackRedirectPath;
    const groupId = Number(req.params.groupId);
    if (!groupId) return res.redirect(redirectPath);
    const memberRows = db
      .prepare("SELECT user_id FROM group_members WHERE group_id = ?")
      .all(groupId);
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM responses WHERE group_id = ?").run(groupId);
      db.prepare("DELETE FROM group_members WHERE group_id = ?").run(groupId);
      db.prepare("DELETE FROM invites WHERE group_id = ?").run(groupId);
      db.prepare("DELETE FROM groups WHERE id = ?").run(groupId);

      const hasMembership = db.prepare(
        "SELECT 1 FROM group_members WHERE user_id = ? LIMIT 1"
      );
      const deleteUser = db.prepare("DELETE FROM users WHERE id = ?");
      for (const row of memberRows) {
        const userId = Number(row.user_id);
        if (!userId) continue;
        const user = db
          .prepare("SELECT id, is_simulated FROM users WHERE id = ?")
          .get(userId);
        if (!user || Number(user.is_simulated) !== 1) continue;
        if (hasMembership.get(userId)) continue;
        deleteUser.run(userId);
      }
    });
    tx();
    res.redirect(redirectPath);
  });

  app.get("/admin", (req, res) => {
    res.redirect("/admin/overview");
  });
}

module.exports = {
  registerAdminRoutes
};
