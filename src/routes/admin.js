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
    clampNumber
  } = deps;

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
        if (String(actualValue) === String(predictedValue)) {
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
      if (actualDriver && predictedDriver && actualDriver === predictedDriver) {
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
      INSERT INTO question_settings (question_id, included, points_override, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(question_id)
      DO UPDATE SET
        included = excluded.included,
        points_override = excluded.points_override,
        updated_at = excluded.updated_at
      `
    );

    try {
      const tx = db.transaction(() => {
        for (const question of questions) {
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
          upsert.run(question.id, included, storedOverride, now);
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

  app.get("/admin/actuals", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const locale = res.locals.locale || "en";
    const questions = getQuestions(locale);
    const roster = getRoster();
    const races = getRaces();
    const actualRows = db.prepare("SELECT * FROM actuals").all();
    const actuals = actualRows.reduce((acc, row) => {
      acc[row.question_id] = row.value;
      return acc;
    }, {});

    res.render("admin_actuals", { user, questions, roster, races, actuals });
  });

  app.post("/admin/actuals", requireAdmin, (req, res) => {
    const questions = getQuestions();
    const races = getRaces();
    const now = new Date().toISOString();
    const upsert = db.prepare(
      `
      INSERT INTO actuals (question_id, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(question_id)
      DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `
    );

    const tx = db.transaction(() => {
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
          const driver = req.body[`${question.id}_driver`];
          if ((!value || value === "") && (!driver || driver === "")) {
            continue;
          }
          upsert.run(question.id, JSON.stringify({ value, driver }), now);
          continue;
        }

        const answer = req.body[question.id];
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

    res.redirect("/admin/actuals");
  });

  app.get("/admin/overview", requireAdmin, (req, res) => {
    const user = getCurrentUser(req);
    const adminError = req.query.error ? String(req.query.error) : null;
    const adminSuccess = req.query.success ? String(req.query.success) : null;
    const groupsPerPage = 10;
    const usersPerPage = 10;
    const membershipsPerPage = 10;
    const responsesPerPage = 10;

    const requestedGroupPage = Number(req.query.groupPage || 1);
    const currentGroupPage = Number.isFinite(requestedGroupPage) && requestedGroupPage > 0
      ? Math.floor(requestedGroupPage)
      : 1;

    const requestedUsersPage = Number(req.query.usersPage || 1);
    const currentUsersPage = Number.isFinite(requestedUsersPage) && requestedUsersPage > 0
      ? Math.floor(requestedUsersPage)
      : 1;

    const requestedMembershipsPage = Number(req.query.membershipsPage || 1);
    const currentMembershipsPage =
      Number.isFinite(requestedMembershipsPage) && requestedMembershipsPage > 0
        ? Math.floor(requestedMembershipsPage)
        : 1;

    const requestedResponsePage = Number(req.query.responsePage || req.query.page || 1);
    const currentResponsePage = Number.isFinite(requestedResponsePage) && requestedResponsePage > 0
      ? Math.floor(requestedResponsePage)
      : 1;

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
      .prepare("SELECT COUNT(*) as count FROM users WHERE is_simulated = 0")
      .get();
    const totalUsers = Number(userCountRow?.count || 0);
    const totalUserPages = Math.max(
      1,
      Math.ceil(totalUsers / usersPerPage)
    );
    const safeUsersPage = Math.min(currentUsersPage, totalUserPages);
    const usersOffset = (safeUsersPage - 1) * usersPerPage;
    const users = db
      .prepare(
        `
        SELECT id, name, email, created_at, is_admin
        FROM users
        WHERE is_simulated = 0
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(usersPerPage, usersOffset);

    const groups = db
      .prepare(
        `
        SELECT g.id, g.name, g.owner_id, u.name as owner_name, g.created_at
        FROM groups g
        JOIN users u ON u.id = g.owner_id
        WHERE COALESCE(g.is_simulated, 0) = 0
        ORDER BY g.created_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(groupsPerPage, groupOffset);

    const membershipCountRow = db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        JOIN groups g ON g.id = gm.group_id
        WHERE u.is_simulated = 0
          AND COALESCE(g.is_simulated, 0) = 0
        `
      )
      .get();
    const totalMemberships = Number(membershipCountRow?.count || 0);
    const totalMembershipPages = Math.max(
      1,
      Math.ceil(totalMemberships / membershipsPerPage)
    );
    const safeMembershipsPage = Math.min(currentMembershipsPage, totalMembershipPages);
    const membershipsOffset = (safeMembershipsPage - 1) * membershipsPerPage;

    const memberships = db
      .prepare(
        `
        SELECT gm.user_id, gm.group_id, gm.role, gm.joined_at, u.name as user_name, g.name as group_name
        FROM group_members gm
        JOIN users u ON u.id = gm.user_id
        JOIN groups g ON g.id = gm.group_id
        WHERE u.is_simulated = 0
          AND COALESCE(g.is_simulated, 0) = 0
        ORDER BY gm.joined_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(membershipsPerPage, membershipsOffset);

    const responseCountRow = db
      .prepare(
        `
        SELECT COUNT(*) as count
        FROM responses r
        JOIN users u ON u.id = r.user_id
        JOIN groups g ON g.id = r.group_id
        WHERE u.is_simulated = 0
          AND COALESCE(g.is_simulated, 0) = 0
        `
      )
      .get();
    const totalResponses = Number(responseCountRow?.count || 0);
    const totalResponsePages = Math.max(
      1,
      Math.ceil(totalResponses / responsesPerPage)
    );
    const safeResponsePage = Math.min(currentResponsePage, totalResponsePages);
    const responseOffset = (safeResponsePage - 1) * responsesPerPage;
    const responses = db
      .prepare(
        `
        SELECT r.user_id, u.name as user_name, r.group_id, g.name as group_name, r.question_id, r.answer, r.updated_at
        FROM responses r
        JOIN users u ON u.id = r.user_id
        JOIN groups g ON g.id = r.group_id
        WHERE u.is_simulated = 0
          AND COALESCE(g.is_simulated, 0) = 0
        ORDER BY r.updated_at DESC
        LIMIT ? OFFSET ?
        `
      )
      .all(responsesPerPage, responseOffset);

    res.render("admin_overview", {
      user,
      adminError,
      adminSuccess,
      users,
      groups,
      memberships,
      responses,
      currentGroupPage: safeGroupPage,
      totalGroupPages,
      groupsPerPage,
      currentUserPage: safeUsersPage,
      totalUserPages,
      usersPerPage,
      currentMembershipsPage: safeMembershipsPage,
      totalMembershipPages,
      membershipsPerPage,
      currentResponsePage: safeResponsePage,
      totalResponsePages,
      responsesPerPage
    });
  });

  app.get(["/admin/analysis", "/admin/testing"], requireAdmin, (req, res) => {
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
          owner.name as owner_name,
          COUNT(gm.user_id) as total_members
        FROM groups g
        JOIN users owner ON owner.id = g.owner_id
        LEFT JOIN group_members gm ON gm.group_id = g.id
        WHERE COALESCE(g.is_simulated, 0) = 1
          AND COALESCE(g.is_global, 0) = 0
        GROUP BY g.id, g.name, g.created_at, owner.name
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
  });

  app.get(
    ["/admin/analysis/:groupId", "/admin/testing/:groupId/analysis"],
    requireAdmin,
    (req, res) => {
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
      analysisMode
    });
  }
  );

  app.get(
    ["/admin/analysis/:groupId/leaderboard", "/admin/testing/:groupId/leaderboard"],
    requireAdmin,
    (req, res) => {
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

      const leaderboardPerPage = 25;
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
        leaderboardTotal: fullLeaderboard.length,
        leaderboardPerPage,
        currentLeaderboardPage: safeLeaderboardPage,
        totalLeaderboardPages,
        leaderboardBasePath: `/admin/analysis/${groupId}/leaderboard`,
        leaderboardQuery: "mode=sim200"
      });
    }
  );

  app.post("/admin/test-group", requireAdmin, (req, res) => {
    const adminUser = getCurrentUser(req);
    if (!adminUser) return res.redirect("/login");

    const now = new Date().toISOString();
    const requestedName = String(req.body.groupName || "").trim();
    const groupName =
      requestedName || `Test Group ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
    const rawCount = Number(req.body.fakePlayerCount || 0);
    const fakePlayerCount = Number.isFinite(rawCount)
      ? Math.max(1, Math.min(5000, Math.floor(rawCount)))
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
        name, owner_id, created_at, is_public, join_code, join_password_hash, rules_text, is_global, is_simulated
      )
      VALUES (?, ?, ?, 0, NULL, NULL, ?, 0, 1)
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
        const groupInfo = insertGroup.run(
          groupName,
          adminUser.id,
          now,
          rulesText
        );
        const groupId = Number(groupInfo.lastInsertRowid);
        createdGroupId = groupId;
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
    if (!userId) return res.redirect("/admin/overview");
    const target = db.prepare("SELECT id, is_admin FROM users WHERE id = ?").get(userId);
    if (!target) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("User not found.")}`
      );
    }
    if (target.is_admin === 1) {
      return res.redirect(
        `/admin/overview?success=${encodeURIComponent("User is already an admin.")}`
      );
    }
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE users SET is_admin = 1, is_verified = 1, verified_at = COALESCE(verified_at, ?) WHERE id = ?"
    ).run(now, userId);
    return res.redirect(
      `/admin/overview?success=${encodeURIComponent("Admin rights granted.")}`
    );
  });

  app.post("/admin/users/:userId/remove-admin", requireAdmin, (req, res) => {
    const userId = Number(req.params.userId);
    if (!userId) return res.redirect("/admin/overview");
    const currentUser = getCurrentUser(req);
    if (currentUser && currentUser.id === userId) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("You cannot remove your own admin rights.")}`
      );
    }
    const target = db.prepare("SELECT id, is_admin FROM users WHERE id = ?").get(userId);
    if (!target) {
      return res.redirect(
        `/admin/overview?error=${encodeURIComponent("User not found.")}`
      );
    }
    if (target.is_admin !== 1) {
      return res.redirect(
        `/admin/overview?success=${encodeURIComponent("User is not an admin.")}`
      );
    }
    db.prepare("UPDATE users SET is_admin = 0 WHERE id = ?").run(userId);
    return res.redirect(
      `/admin/overview?success=${encodeURIComponent("Admin rights removed.")}`
    );
  });

  app.post("/admin/users/:userId/delete", requireAdmin, (req, res) => {
    const userId = Number(req.params.userId);
    if (!userId) return res.redirect("/admin/overview");
    db.prepare("DELETE FROM responses WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM group_members WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM groups WHERE owner_id = ?").run(userId);
    db.prepare("DELETE FROM invites WHERE created_by = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    res.redirect("/admin/overview");
  });

  app.post("/admin/groups/:groupId/delete", requireAdmin, (req, res) => {
    const source = String(req.query.from || "").trim().toLowerCase();
    const redirectPath =
      source === "testing" || source === "analysis"
        ? "/admin/analysis"
        : "/admin/overview";
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
