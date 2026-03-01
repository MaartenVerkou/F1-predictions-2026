const fs = require("fs");
const path = require("path");

const DEFAULT_SEASON = 2025;
const parsedSeason = Number(process.argv[2] || process.env.LAST_SEASON || DEFAULT_SEASON);
const SEASON = Number.isFinite(parsedSeason) && parsedSeason > 0 ? parsedSeason : DEFAULT_SEASON;
const API_BASE = "https://api.jolpi.ca/ergast/f1";
const OUT_PATH = path.join(__dirname, "..", "data", "last-season-results.json");
const DESTRUCTORS_SOURCE_URL = "https://www.racingstatisticsf1.com/f1-destructors-championship";
const DRIVER_OF_THE_DAY_SOURCE_URL = "https://tracinginsights.com/2025/driver-of-the-day/";

function driverName(driver) {
  if (!driver) return "Unknown";
  const raw = `${driver.givenName || ""} ${driver.familyName || ""}`.trim();
  return raw.normalize("NFKD").replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, " ").trim();
}

function parseNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isDnfStatus(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  if (!s) return false;
  if (s.includes("finished") || s.includes("lapped") || s.startsWith("+")) return false;
  if (s.includes("disqual") || s.includes("did not start") || s.includes("did not qualify") || s.includes("withdrew")) {
    return false;
  }
  return true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, { retries = 6, baseDelayMs = 700 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const res = await fetch(url, {
      headers: {
        "user-agent": "f1-predictions-last-season-script"
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

function formatPairBattle(left, right, pointsByDriver) {
  const lp = parseNum(pointsByDriver.get(left), 0);
  const rp = parseNum(pointsByDriver.get(right), 0);
  const diff = Math.abs(lp - rp);
  if (lp === rp) return `Tie (${diff})`;
  return `${lp > rp ? left : right} (${diff})`;
}

function pickClosestTeam(qualStats) {
  const rows = Array.from(qualStats.entries())
    .map(([team, stat]) => {
      const total = stat.aWins + stat.bWins;
      const diff = Math.abs(stat.aWins - stat.bWins);
      return {
        team,
        total,
        diff,
        duel: `${stat.aName} ${stat.aWins}-${stat.bWins} ${stat.bName}`
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => {
      if (a.diff !== b.diff) return a.diff - b.diff;
      if (b.total !== a.total) return b.total - a.total;
      return a.team.localeCompare(b.team);
    });
  return rows[0] || null;
}

function topTiedRows(entries, getScore) {
  const rows = Array.isArray(entries) ? entries.slice() : [];
  rows.sort((a, b) => getScore(b) - getScore(a));
  if (!rows.length) return [];
  const topScore = getScore(rows[0]);
  return rows.filter((row) => getScore(row) === topScore);
}

async function main() {
  const [driverStandingsJson, constructorStandingsJson, scheduleJson] = await Promise.all([
    fetchJson(`${API_BASE}/${SEASON}/driverStandings.json`),
    fetchJson(`${API_BASE}/${SEASON}/constructorStandings.json`),
    fetchJson(`${API_BASE}/${SEASON}.json`)
  ]);

  const driverStandings =
    driverStandingsJson?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
  const constructorStandings =
    constructorStandingsJson?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
  const races = scheduleJson?.MRData?.RaceTable?.Races || [];

  const top3Drivers = driverStandings.slice(0, 3).map((row) => driverName(row.Driver));
  const lastDriver = driverName(driverStandings[driverStandings.length - 1]?.Driver);
  const championDriver = driverName(driverStandings[0]?.Driver);

  const top3Constructors = constructorStandings
    .slice(0, 3)
    .map((row) => row?.Constructor?.name || "Unknown");
  const lastConstructor = constructorStandings[constructorStandings.length - 1]?.Constructor?.name || "Unknown";

  const pointsByDriver = new Map(
    driverStandings.map((row) => [driverName(row.Driver), parseNum(row.points)])
  );

  const driverDnfCounts = new Map();
  const raceDnfRows = [];
  const podiumDrivers = new Set();
  const podiumTeams = new Set();
  const winnerGridRows = [];
  const qualStats = new Map();
  const sprintPointsByDriver = new Map();

  for (const race of races) {
    const round = race.round;
    const raceResultsJson = await fetchJson(`${API_BASE}/${SEASON}/${round}/results.json`);
    await sleep(180);
    const qualifyingJson = await fetchJson(`${API_BASE}/${SEASON}/${round}/qualifying.json`);
    await sleep(180);
    const sprintJson = await fetchJson(`${API_BASE}/${SEASON}/${round}/sprint.json`);
    await sleep(180);

    const raceResult = raceResultsJson?.MRData?.RaceTable?.Races?.[0];
    const results = raceResult?.Results || [];

    let dnfCountThisRace = 0;
    for (const row of results) {
      const dName = driverName(row.Driver);
      const cName = row?.Constructor?.name || "Unknown";
      const pos = parseNum(row.position, 0);
      if (pos >= 1 && pos <= 3) {
        podiumDrivers.add(dName);
        podiumTeams.add(cName);
      }
      if (pos === 1) {
        winnerGridRows.push({
          raceName: raceResult?.raceName || race.raceName,
          driver: dName,
          grid: parseNum(row.grid, 0)
        });
      }
      if (isDnfStatus(row.status)) {
        dnfCountThisRace += 1;
        driverDnfCounts.set(dName, (driverDnfCounts.get(dName) || 0) + 1);
      }
    }

    raceDnfRows.push({
      raceName: raceResult?.raceName || race.raceName,
      dnfCount: dnfCountThisRace
    });

    const qualRace = qualifyingJson?.MRData?.RaceTable?.Races?.[0];
    const qualRows = qualRace?.QualifyingResults || [];
    const byTeam = new Map();
    for (const row of qualRows) {
      const team = row?.Constructor?.name || "Unknown";
      const pos = parseNum(row.position, 999);
      if (!byTeam.has(team)) byTeam.set(team, []);
      byTeam.get(team).push({
        name: driverName(row.Driver),
        pos
      });
    }
    for (const [team, drivers] of byTeam.entries()) {
      if (drivers.length < 2) continue;
      const sorted = drivers
        .slice()
        .sort((a, b) => a.pos - b.pos)
        .slice(0, 2);
      if (!qualStats.has(team)) {
        qualStats.set(team, {
          aName: sorted[0].name,
          bName: sorted[1].name,
          aWins: 0,
          bWins: 0
        });
      }
      const stat = qualStats.get(team);
      if (sorted[0].name === stat.aName) {
        stat.aWins += 1;
      } else if (sorted[0].name === stat.bName) {
        stat.bWins += 1;
      } else {
        if (stat.aWins <= stat.bWins) {
          stat.aName = sorted[0].name;
          stat.aWins += 1;
        } else {
          stat.bName = sorted[0].name;
          stat.bWins += 1;
        }
      }
    }

    const sprintRace = sprintJson?.MRData?.RaceTable?.Races?.[0];
    const sprintRows = sprintRace?.SprintResults || [];
    for (const row of sprintRows) {
      const name = driverName(row.Driver);
      sprintPointsByDriver.set(name, (sprintPointsByDriver.get(name) || 0) + parseNum(row.points, 0));
    }
  }

  const dnfRows = Array.from(driverDnfCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const mostDnfDriverRows = topTiedRows(dnfRows, (row) => Number(row.count || 0));

  const lowestGridWin = winnerGridRows
    .slice()
    .sort((a, b) => b.grid - a.grid || a.raceName.localeCompare(b.raceName))[0] || null;

  const topDnfRaces = raceDnfRows
    .slice()
    .sort((a, b) => b.dnfCount - a.dnfCount || a.raceName.localeCompare(b.raceName))
    .slice(0, 3);

  const constructorByName = new Map(
    constructorStandings.map((row) => [row?.Constructor?.name || "Unknown", parseNum(row.points, 0)])
  );
  const noPodiumCandidates = Array.from(constructorByName.entries())
    .filter(([name]) => !podiumTeams.has(name))
    .map(([name, points]) => ({ name, points }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const topNoPodiumCandidates = topTiedRows(
    noPodiumCandidates,
    (row) => Number(row.points || 0)
  );

  const mercedesEngineTeams = new Set(["Mercedes", "McLaren", "Williams", "Aston Martin"]);
  const top5ConstructorNames = constructorStandings
    .slice(0, 5)
    .map((row) => row?.Constructor?.name || "Unknown");
  const mercedesTop5Count = top5ConstructorNames.filter((team) => mercedesEngineTeams.has(team)).length;

  const ferrariDrivers = driverStandings
    .filter((row) => (row?.Constructors || []).some((c) => c?.name === "Ferrari"))
    .map((row) => driverName(row.Driver))
    .slice(0, 2);

  const sprintChampion = Array.from(sprintPointsByDriver.entries())
    .map(([name, points]) => ({ name, points }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))[0] || null;

  const firstRaceWinner = winnerGridRows.find((row) => row.raceName === races[0]?.raceName) || winnerGridRows[0] || null;
  const destructorsTeamResult =
    SEASON === 2025
      ? "Alpine ($5,348,000 = 1,327,000 + 1,877,000 + 2,144,000)"
      : "No official FIA damage total (see external damage estimate)";
  const destructorsDriverResult =
    SEASON === 2025
      ? "Gabriel Bortoleto ($3,967,000)"
      : "No official FIA damage total (see external damage estimate)";
  const mostDriverOfTheDayResult =
    SEASON === 2025 ? "Max Verstappen (8)" : "See season Driver of the Day archive";
  const mostDriverOfTheDayLabel =
    SEASON === 2025 ? `${SEASON} Driver of the Day standings` : `${SEASON} Driver of the Day archive`;
  const mostDriverOfTheDayUrl =
    SEASON === 2025
      ? DRIVER_OF_THE_DAY_SOURCE_URL
      : `https://www.formula1.com/en/latest/all.html?keyword=Driver+of+the+Day+${SEASON}`;
  const racesBeforeTitleDecidedResult =
    SEASON === 2025 ? "0" : "See points progression by round";

  const references = {
    season: SEASON,
    generated_at: new Date().toISOString(),
    notes: "Generated from Ergast/Jolpica race and standings endpoints plus selected external reference links.",
    questions: {
      drivers_championship_top_3: {
        season: SEASON,
        result: top3Drivers.length ? top3Drivers.join(" > ") : "n/a",
        label: `${SEASON} driver standings`,
        url: `${API_BASE}/${SEASON}/driverStandings.json`
      },
      drivers_championship_last: {
        season: SEASON,
        result: lastDriver || "n/a",
        label: `${SEASON} driver standings`,
        url: `${API_BASE}/${SEASON}/driverStandings.json`
      },
      constructors_championship_top_3: {
        season: SEASON,
        result: top3Constructors.length ? top3Constructors.join(" > ") : "n/a",
        label: `${SEASON} constructor standings`,
        url: `${API_BASE}/${SEASON}/constructorStandings.json`
      },
      constructors_championship_last: {
        season: SEASON,
        result: lastConstructor || "n/a",
        label: `${SEASON} constructor standings`,
        url: `${API_BASE}/${SEASON}/constructorStandings.json`
      },
      all_teams_score_points: {
        season: SEASON,
        result: constructorStandings.every((row) => parseNum(row.points, 0) > 0) ? "Yes" : "No",
        label: `${SEASON} constructor standings`,
        url: `${API_BASE}/${SEASON}/constructorStandings.json`
      },
      most_driver_of_the_day: {
        season: SEASON,
        result: mostDriverOfTheDayResult,
        label: mostDriverOfTheDayLabel,
        url: mostDriverOfTheDayUrl
      },
      most_dnfs_driver: {
        season: SEASON,
        result: mostDnfDriverRows.length
          ? mostDnfDriverRows.map((row) => `${row.name} (${row.count})`).join(" / ")
          : "n/a",
        results: mostDnfDriverRows.map((row) => `${row.name} (${row.count})`),
        label: `${SEASON} race results (DNF statuses)`,
        url: `${API_BASE}/${SEASON}/results.json`
      },
      destructors_team: {
        season: SEASON,
        result: destructorsTeamResult,
        label: `${SEASON} estimated damage standings`,
        url: DESTRUCTORS_SOURCE_URL
      },
      destructors_driver: {
        season: SEASON,
        result: destructorsDriverResult,
        label: `${SEASON} estimated damage standings`,
        url: DESTRUCTORS_SOURCE_URL
      },
      all_podium_finishers: {
        season: SEASON,
        result: Array.from(podiumDrivers).sort((a, b) => a.localeCompare(b)).join(", "),
        label: `${SEASON} race results (all podium finishers)`,
        url: `${API_BASE}/${SEASON}/results.json`
      },
      teammate_battle_antonelli_russell: {
        season: SEASON,
        result: formatPairBattle("Andrea Kimi Antonelli", "George Russell", pointsByDriver),
        label: `${SEASON} driver standings`,
        url: `${API_BASE}/${SEASON}/driverStandings.json`
      },
      teammate_battle_lawson_lindblad: {
        season: SEASON,
        result: formatPairBattle("Lando Norris", "Oscar Piastri", pointsByDriver),
        label: `${SEASON} driver standings`,
        url: `${API_BASE}/${SEASON}/driverStandings.json`
      },
      alpine_vs_cadillac_audi: {
        season: SEASON,
        result: "Not directly comparable (Cadillac and Audi did not both race in 2025)",
        label: `${SEASON} constructor standings`,
        url: `${API_BASE}/${SEASON}/constructorStandings.json`
      },
      most_points_no_podium: {
        season: SEASON,
        result: topNoPodiumCandidates[0]
          ? topNoPodiumCandidates
              .map((row) => `${row.name} (${row.points})`)
              .join(" / ")
          : "All teams scored a podium",
        results: topNoPodiumCandidates.map((row) => `${row.name} (${row.points})`),
        label: `${SEASON} constructor standings + podium teams`,
        url: `${API_BASE}/${SEASON}/constructorStandings.json`
      },
      lowest_grid_win_position: {
        season: SEASON,
        result: lowestGridWin ? `${lowestGridWin.grid} - ${lowestGridWin.driver} (${lowestGridWin.raceName})` : "n/a",
        label: `${SEASON} race winner grid positions`,
        url: `${API_BASE}/${SEASON}/results.json`
      },
      select_three_races_dnfs: {
        season: SEASON,
        result: topDnfRaces.map((row) => `${row.raceName} (${row.dnfCount})`).join(", "),
        label: `${SEASON} DNF counts by race`,
        url: `${API_BASE}/${SEASON}/results.json`
      },
      closest_qualifying_teammates: {
        season: SEASON,
        result: (() => {
          const closest = pickClosestTeam(qualStats);
          return closest ? `${closest.team} (${closest.duel})` : "n/a";
        })(),
        label: `${SEASON} qualifying head-to-head`,
        url: `${API_BASE}/${SEASON}/qualifying.json`
      },
      races_before_title_decided: {
        season: SEASON,
        result: racesBeforeTitleDecidedResult,
        label: `${SEASON} driver standings by round`,
        url: `${API_BASE}/${SEASON}/driverStandings.json`
      },
      mini_q1_first_race_winner_champion: {
        season: SEASON,
        result: firstRaceWinner && championDriver && firstRaceWinner.driver === championDriver ? "Yes" : "No",
        label: `${SEASON} race 1 winner vs champion`,
        url: `${API_BASE}/${SEASON}/1/results.json`
      },
      mini_q2_mercedes_engines_top5: {
        season: SEASON,
        result: mercedesTop5Count >= 4 ? "Yes" : "No",
        label: `${SEASON} top-5 constructors with Mercedes engines (${mercedesTop5Count}/5)`,
        url: `${API_BASE}/${SEASON}/constructorStandings.json`
      },
      mini_q3_ferrari_podium: {
        season: SEASON,
        result: ferrariDrivers.length >= 2 && ferrariDrivers.every((name) => podiumDrivers.has(name)) ? "Yes" : "No",
        label: `${SEASON} race podium results`,
        url: `${API_BASE}/${SEASON}/results.json`
      },
      mini_q4_sprint_champion_same: {
        season: SEASON,
        result: sprintChampion && championDriver && sprintChampion.name === championDriver ? "Yes" : "No",
        label: `${SEASON} sprint points summary`,
        url: `${API_BASE}/${SEASON}/sprint.json`
      },
      mini_q5_team_engine_switch_2027_2028: {
        season: SEASON,
        result: "See season announcement archive",
        label: `${SEASON} team news archive`,
        url: `https://www.formula1.com/en/latest/all.html?keyword=engine+${SEASON}`
      }
    }
  };

  fs.writeFileSync(OUT_PATH, `${JSON.stringify(references, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
