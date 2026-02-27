#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
if (argv.includes("--help") || argv.includes("-h")) {
  console.log("node scripts/analyze-balance.js --players 1000 --seasons 200 --seed 42 --top 12 --json report.json");
  process.exit(0);
}

const cfg = {
  players: Math.max(2, Number(arg("--players", 1000))),
  seasons: Math.max(1, Number(arg("--seasons", 200))),
  seed: Number(arg("--seed", 20260227)),
  top: Math.max(1, Number(arg("--top", 12))),
  json: arg("--json", "")
};

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(cfg.seed);
const nrm = (m = 0, sd = 1) => {
  const u1 = Math.max(1e-12, R());
  const u2 = Math.max(1e-12, R());
  return m + Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * sd;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (arr) => arr[Math.floor(R() * arr.length)];
const rank = (arr, score, c, asc = false) =>
  [...arr]
    .sort((a, b) => (asc ? score[a] - score[b] : score[b] - score[a]))
    .slice(0, c);

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const root = path.resolve(__dirname, "..");
const questions = readJson(path.join(root, "data/questions.json")).questions;
const roster = readJson(path.join(root, "data/roster.json"));
const races = readJson(path.join(root, "data/races.json")).races || [];
const drivers = roster.drivers || [];
const teams = roster.teams || [];

const teamBase = {
  "McLaren": 95, "Ferrari": 92, "Red Bull Racing": 90, "Mercedes": 88, "Williams": 75,
  "Aston Martin": 73, "Racing Bulls": 69, "Haas F1 Team": 66, "Audi": 63, "Alpine": 60, "Cadillac": 55
};
const dTeam = {
  "Max Verstappen": "Red Bull Racing", "Sergio Perez": "Red Bull Racing",
  "Lando Norris": "McLaren", "Oscar Piastri": "McLaren",
  "Charles Leclerc": "Ferrari", "Lewis Hamilton": "Ferrari",
  "George Russell": "Mercedes", "Kimi Antonelli": "Mercedes",
  "Fernando Alonso": "Aston Martin", "Lance Stroll": "Aston Martin",
  "Carlos Sainz Jr.": "Williams", "Alexander Albon": "Williams",
  "Esteban Ocon": "Haas F1 Team", "Oliver Bearman": "Haas F1 Team",
  "Liam Lawson": "Racing Bulls", "Arvid Lindblad": "Racing Bulls",
  "Pierre Gasly": "Alpine", "Isack Hadjar": "Alpine",
  "Nico Hulkenberg": "Audi", "Gabriel Bortoleto": "Audi",
  "Valtteri Bottas": "Cadillac", "Franco Colapinto": "Cadillac"
};
const dSkill = {
  "Max Verstappen": 98, "Lando Norris": 95, "Oscar Piastri": 94, "Charles Leclerc": 93, "Lewis Hamilton": 92,
  "George Russell": 91, "Kimi Antonelli": 88, "Carlos Sainz Jr.": 86, "Fernando Alonso": 86, "Sergio Perez": 85,
  "Alexander Albon": 84, "Pierre Gasly": 82, "Esteban Ocon": 81, "Nico Hulkenberg": 80, "Liam Lawson": 79,
  "Oliver Bearman": 78, "Valtteri Bottas": 77, "Lance Stroll": 76, "Arvid Lindblad": 75, "Isack Hadjar": 74,
  "Gabriel Bortoleto": 73, "Franco Colapinto": 72
};
const dRel = Object.fromEntries(drivers.map((d) => [d, 0.76 + R() * 0.2]));
const dAgg = Object.fromEntries(drivers.map((d) => [d, 0.3 + R() * 0.35]));
const dPop = Object.fromEntries(drivers.map((d) => [d, 0.4 + R() * 0.6]));

for (const t of teams) if (teamBase[t] == null) teamBase[t] = 62;
for (const d of drivers) {
  if (!dTeam[d]) dTeam[d] = teams[0];
  if (dSkill[d] == null) dSkill[d] = 75;
}
const teamDrivers = {};
for (const t of teams) teamDrivers[t] = [];
for (const d of drivers) teamDrivers[dTeam[d]].push(d);
const expD = Object.fromEntries(drivers.map((d) => [d, teamBase[dTeam[d]] + dSkill[d] * 0.45]));
const expT = Object.fromEntries(teams.map((t) => [t, (teamDrivers[t] || []).reduce((s, d) => s + expD[d], 0)]));

function scoreQ(q, p, a) {
  if (a == null || p == null) return 0;
  const t = q.type || "text";
  const eq = (x, y) => (Array.isArray(x) ? x.includes(y) : String(x) === String(y));
  if (t === "ranking") {
    const keys = ["1st", "2nd", "3rd", "4th", "5th"]; let s = 0;
    for (let i = 0; i < (q.count || 3); i++) if (a[i] != null && p[i] != null && eq(a[i], p[i])) s += Number((q.points || {})[keys[i]] || 0);
    return s;
  }
  if (t === "single_choice" || t === "text") {
    if (q.special_case === "all_podiums_bonus" && String(a) === String(q.bonus_value)) return String(p) === String(q.bonus_value) ? Number(q.bonus_points || 0) : 0;
    return eq(a, p) ? Number(q.points || 0) : 0;
  }
  if (t === "boolean") return eq(a, p) ? Number(q.points || 0) : 0;
  if (t === "multi_select") {
    const ps = Number(q.points || 0), pen = Number(q.penalty ?? ps), min = Number(q.minimum ?? 0);
    const as = new Set(a || []), psx = new Set(p || []);
    let c = 0, w = 0, m = 0;
    psx.forEach((x) => (as.has(x) ? c++ : w++));
    as.forEach((x) => (!psx.has(x) ? m++ : 0));
    return Math.max(min, c * ps - (w + m) * pen);
  }
  if (t === "teammate_battle") {
    const aw = a?.winner, pw = p?.winner, ad = Number(a?.diff), pd = Number(p?.diff);
    if (!aw) return 0;
    if (aw === "tie") return pw === "tie" ? Number(q.tie_bonus || 0) : 0;
    if (pw !== aw || !Number.isFinite(ad) || !Number.isFinite(pd)) return 0;
    return Math.max(0, Number(q.points || 0) - Math.abs(pd - ad));
  }
  if (t === "boolean_with_optional_driver") {
    if (a?.choice == null || p?.choice == null) return 0;
    if (String(a.choice) !== String(p.choice)) return 0;
    let s = Number(q.points || 0);
    if (String(a.choice) === "yes" && a.driver && String(a.driver) === String(p.driver)) s += Number(q.bonus_points || 0);
    return s;
  }
  if (t === "numeric_with_driver" || t === "single_choice_with_driver") {
    let s = 0;
    if (a?.value != null && p?.value != null) {
      if (String(a.value) === String(p.value)) s += Number((q.points || {}).position || 0);
      else if (t === "single_choice_with_driver" && q.position_nearby_points) {
        const num = (v) => {
          const r = String(v).trim().toLowerCase();
          if (r === "pitlane" || r === "pit lane") return 23;
          const n = Number(r);
          return Number.isFinite(n) ? n : null;
        };
        const d = Math.abs((num(a.value) ?? 999) - (num(p.value) ?? 999));
        s += Number((q.position_nearby_points || {})[String(d)] || 0);
      }
    }
    if (a?.driver && p?.driver && a.driver === p.driver) s += Number((q.points || {}).driver || 0);
    return s;
  }
  if (t === "multi_select_limited") {
    const ps = Number(q.points || 0), byRace = a?.dnf_by_race || {};
    return (p || []).reduce((s, r) => s + Number(byRace[r] || 0) * ps, 0);
  }
  if (t === "numeric") return Number(a) === Number(p) ? Number(q.points || 0) : 0;
  return 0;
}

function makeActual(qById) {
  const dS = Object.fromEntries(drivers.map((d) => [d, expD[d] + nrm(0, 15)]));
  const dOrd = rank(drivers, dS, drivers.length);
  const tS = Object.fromEntries(teams.map((t) => [t, (teamDrivers[t] || []).reduce((s, d) => s + dS[d], 0)]));
  const tOrd = rank(teams, tS, teams.length);
  const dnf = Object.fromEntries(drivers.map((d) => [d, Math.max(0, Math.round((1 - dRel[d]) * 18 + nrm(0, 2.5)))]));
  const dmg = Object.fromEntries(drivers.map((d) => [d, dnf[d] * (0.8 + dAgg[d] * 1.8) + Math.max(0, nrm(0, 1.5))]));
  const dod = Object.fromEntries(drivers.map((d) => [d, dPop[d] * 4 + dS[d] / 120 + nrm(0, 0.8)]));
  const podN = clamp(Math.round(8 + R() * 6), 5, 16);
  const podiumSet = rank(drivers, dS, podN);
  const podiumTeams = new Set(podiumSet.map((d) => dTeam[d]));
  const noPodTeams = teams.filter((t) => !podiumTeams.has(t));
  const racesDnf = Object.fromEntries(races.map((r) => [r, clamp(Math.round(2.2 + nrm(0, 1.4)), 0, 8)]));
  const closeTeam = rank(teams, Object.fromEntries(teams.map((t) => {
    const p = teamDrivers[t] || [];
    const diff = p.length >= 2 ? Math.abs((dSkill[p[0]] || 75) - (dSkill[p[1]] || 75)) : 99;
    return [t, -diff + nrm(0, 0.8)];
  })), 1)[0];
  const champGap = (dS[dOrd[0]] || 0) - (dS[dOrd[1]] || 0);
  const rb = clamp(Math.round(champGap / 6 + nrm(0, 1.8)), 0, 10);
  const pair = (id) => {
    const o = qById[id]?.options || [];
    const a = o[0], b = o[1], da = dS[a] || 0, db = dS[b] || 0;
    return da === db ? { winner: "tie", diff: 0 } : { winner: da > db ? a : b, diff: Math.round(Math.abs(da - db) * 3) };
  };
  const lg = clamp(Math.round(2.8 + nrm(0, 2.2)), 1, 22);
  return {
    drivers_championship_top_3: dOrd.slice(0, 3),
    drivers_championship_last: dOrd[dOrd.length - 1],
    constructors_championship_top_3: tOrd.slice(0, 3),
    constructors_championship_last: tOrd[tOrd.length - 1],
    all_teams_score_points: Object.values(tS).every((v) => v > 0) ? "yes" : "no",
    most_driver_of_the_day: rank(drivers, dod, 1)[0],
    most_dnfs_driver: rank(drivers, dnf, 1)[0],
    destructors_team: rank(teams, Object.fromEntries(teams.map((t) => [t, (teamDrivers[t] || []).reduce((s, d) => s + dmg[d], 0)])), 1)[0],
    destructors_driver: rank(drivers, dmg, 1)[0],
    all_podium_finishers: podiumSet,
    teammate_battle_antonelli_russell: pair("teammate_battle_antonelli_russell"),
    teammate_battle_lawson_lindblad: pair("teammate_battle_lawson_lindblad"),
    alpine_vs_cadillac_audi: (tS.Alpine || 0) > (tS.Cadillac || 0) + (tS.Audi || 0) + (tS["Aston Martin"] || 0) ? "More" : "Less",
    most_points_no_podium: noPodTeams.length ? rank(noPodTeams, tS, 1)[0] : "All teams scored a podium",
    race_ban: R() < 0.22 ? { choice: "yes", driver: rank(drivers, Object.fromEntries(drivers.map((d) => [d, dnf[d] + dAgg[d] * 10])), 1)[0] } : { choice: "no", driver: null },
    lowest_grid_win_position: { value: R() < 0.02 ? "Pitlane" : String(lg), driver: dOrd[0] },
    select_three_races_dnfs: { dnf_by_race: racesDnf },
    closest_qualifying_teammates: closeTeam,
    races_before_title_decided: rb,
    mini_q1_first_race_winner_champion: R() < 0.24 ? "yes" : "no",
    mini_q2_mercedes_engines_top5: R() < 0.5 ? "yes" : "no",
    mini_q3_ferrari_podium: ((podiumSet.includes("Charles Leclerc") && podiumSet.includes("Lewis Hamilton")) ? "yes" : "no"),
    mini_q4_sprint_champion_same: R() < clamp(0.42 + champGap / 80, 0.2, 0.9) ? "yes" : "no",
    mini_q5_team_engine_switch_2027_2028: R() < 0.46 ? "yes" : "no"
  };
}

function makePred(q, k) {
  const no = 22 * (1 - k) + 2;
  const b = (py) => (R() < clamp(0.5 + (py - 0.5) * (0.55 + 0.85 * k) + nrm(0, 0.06), 0.02, 0.98) ? "yes" : "no");
  const qid = q.id;
  if (qid === "drivers_championship_top_3") return rank(drivers, Object.fromEntries(drivers.map((d) => [d, expD[d] + nrm(0, no)])), 3);
  if (qid === "drivers_championship_last") return rank(drivers, Object.fromEntries(drivers.map((d) => [d, expD[d] + nrm(0, no)])), 1, true)[0];
  if (qid === "constructors_championship_top_3") return rank(teams, Object.fromEntries(teams.map((t) => [t, expT[t] + nrm(0, no * 0.8)])), 3);
  if (qid === "constructors_championship_last") return rank(teams, Object.fromEntries(teams.map((t) => [t, expT[t] + nrm(0, no * 0.8)])), 1, true)[0];
  if (qid === "all_teams_score_points") return b(0.44);
  if (qid === "most_driver_of_the_day") return rank(drivers, Object.fromEntries(drivers.map((d) => [d, expD[d] * 0.35 + dPop[d] * 40 + nrm(0, no * 0.4)])), 1)[0];
  if (qid === "most_dnfs_driver") return rank(drivers, Object.fromEntries(drivers.map((d) => [d, (1 - dRel[d]) * 100 + dAgg[d] * 12 + nrm(0, no * 0.3)])), 1)[0];
  if (qid === "destructors_team") return rank(teams, Object.fromEntries(teams.map((t) => [t, (teamDrivers[t] || []).reduce((s, d) => s + (1 - dRel[d]) * 55 + dAgg[d] * 16, 0) + nrm(0, no * 0.25)])), 1)[0];
  if (qid === "destructors_driver") return rank(drivers, Object.fromEntries(drivers.map((d) => [d, (1 - dRel[d]) * 100 + dAgg[d] * 20 + nrm(0, no * 0.3)])), 1)[0];
  if (qid === "all_podium_finishers") return rank(drivers, Object.fromEntries(drivers.map((d) => [d, expD[d] + nrm(0, no * 0.55)])), clamp(Math.round(7 + k * 5 + nrm(0, 1.8)), 4, 16));
  if (qid === "teammate_battle_antonelli_russell" || qid === "teammate_battle_lawson_lindblad") { const a = q.options?.[0], b2 = q.options?.[1]; const da = expD[a] || 0, db = expD[b2] || 0; const w = Math.abs(da - db) < 1.6 ? "tie" : (da > db ? a : b2); return { winner: w, diff: w === "tie" ? 0 : Math.max(0, Math.round(Math.abs(da - db) * 3 + nrm(0, no * 0.8))) }; }
  if (qid === "alpine_vs_cadillac_audi") { const p = (expT.Alpine || 0) > (expT.Cadillac || 0) + (expT.Audi || 0) + (expT["Aston Martin"] || 0) ? 0.6 : 0.12; return R() < p ? "More" : "Less"; }
  if (qid === "most_points_no_podium") return R() < 0.04 ? "All teams scored a podium" : rank(teams, Object.fromEntries(teams.map((t) => [t, expT[t] - Math.max(0, (expT[t] - 130) / 2) + nrm(0, no * 0.35)])), 1)[0];
  if (qid === "race_ban") return b(0.22) === "yes" ? { choice: "yes", driver: rank(drivers, Object.fromEntries(drivers.map((d) => [d, (1 - dRel[d]) * 80 + dAgg[d] * 22 + nrm(0, no * 0.35)])), 1)[0] } : { choice: "no", driver: null };
  if (qid === "lowest_grid_win_position") return { value: R() < 0.018 ? "Pitlane" : String(clamp(Math.round(3.3 + (1 - k) * 2 + nrm(0, 1.7)), 1, 22)), driver: rank(drivers, Object.fromEntries(drivers.map((d) => [d, expD[d] + nrm(0, no * 0.45)])), 1)[0] };
  if (qid === "select_three_races_dnfs") return rank(races, Object.fromEntries(races.map((r) => [r, (/monaco|singapore|azerbaijan|las vegas|sao paulo/i.test(r) ? 3 : 1) + nrm(0, (1 - k) * 1.2)])), 3);
  if (qid === "closest_qualifying_teammates") return rank(teams, Object.fromEntries(teams.map((t) => { const p = teamDrivers[t] || []; const d = p[1] ? Math.abs(dSkill[p[0]] - dSkill[p[1]]) : 99; return [t, -d + nrm(0, no * 0.2)]; })), 1)[0];
  if (qid === "races_before_title_decided") return clamp(Math.round(((expD[rank(drivers, expD, 1)[0]] - expD[rank(drivers, expD, 2)[1]]) / 4.2) + nrm(0, 1.7 + (1 - k))), 0, 10);
  if (qid === "mini_q1_first_race_winner_champion") return b(0.24);
  if (qid === "mini_q2_mercedes_engines_top5") return b(0.48);
  if (qid === "mini_q3_ferrari_podium") return b(0.66);
  if (qid === "mini_q4_sprint_champion_same") return b(0.56);
  if (qid === "mini_q5_team_engine_switch_2027_2028") return b(0.52);
  return pick((q.options || []).length ? q.options : ["yes", "no"]);
}

const qById = Object.fromEntries(questions.map((q) => [q.id, q]));
const stats = Object.fromEntries(questions.map((q) => [q.id, { flip: 0, sumP: 0, sumW: 0 }]));
let sum = 0, sumSq = 0, n = 0, wSum = 0;
for (let s = 0; s < cfg.seasons; s++) {
  const actual = makeActual(qById);
  const tot = Array(cfg.players).fill(0);
  const qScore = Object.fromEntries(questions.map((q) => [q.id, Array(cfg.players).fill(0)]));
  for (let p = 0; p < cfg.players; p++) {
    const k = clamp(0.62 + nrm(0, 0.16), 0.2, 0.96);
    for (const q of questions) {
      const sc = scoreQ(q, makePred(q, k), actual[q.id]);
      qScore[q.id][p] = sc;
      tot[p] += sc;
    }
    sum += tot[p]; sumSq += tot[p] * tot[p]; n++;
  }
  const win = tot.indexOf(Math.max(...tot));
  wSum += tot[win];
  for (const q of questions) {
    const arr = qScore[q.id];
    stats[q.id].sumP += arr.reduce((a, b) => a + b, 0);
    stats[q.id].sumW += arr[win];
    const alt = tot.map((v, i) => v - arr[i]);
    if (alt.indexOf(Math.max(...alt)) !== win) stats[q.id].flip++;
  }
}

const avg = sum / n;
const std = Math.sqrt(Math.max(0, sumSq / n - avg * avg));
const wAvg = wSum / cfg.seasons;
const impactLabel = (flipRate, winnerShare) => {
  if (flipRate >= 35 || winnerShare >= 12) return "HIGH";
  if (flipRate >= 15 || winnerShare >= 6) return "MED";
  return "LOW";
};
const rows = questions.map((q) => {
  const x = stats[q.id];
  const aw = x.sumW / cfg.seasons;
  const flipRate = (x.flip / cfg.seasons) * 100;
  const winnerShare = wAvg ? (aw / wAvg) * 100 : 0;
  const dominance = flipRate * 0.65 + winnerShare * 0.35;
  return {
    id: q.id,
    flipRate,
    winnerShare,
    dominance,
    impact: impactLabel(flipRate, winnerShare),
    avgWinner: aw,
    avgPlayer: x.sumP / (cfg.seasons * cfg.players)
  };
}).sort((a, b) => b.dominance - a.dominance || b.flipRate - a.flipRate);

const f = (v, w) => String(v).padEnd(w, " ").slice(0, w);
const fr = (v, w) => String(v).padStart(w, " ").slice(-w);
console.log("\nScoring balance simulation");
console.log("--------------------------");
console.log(`Players per season: ${cfg.players}`);
console.log(`Simulated seasons : ${cfg.seasons}`);
console.log(`Seed              : ${cfg.seed}`);
console.log(`Average total/player: ${avg.toFixed(2)} (+/- ${std.toFixed(2)})`);
console.log(`Average winner score: ${wAvg.toFixed(2)}\n`);
console.log(`${f("Question ID", 42)} ${fr("Impact", 6)} ${fr("Flip%", 7)} ${fr("Winner%", 9)} ${fr("Avg/win", 9)} ${fr("Avg/p", 8)}`);
for (const r of rows.slice(0, cfg.top)) {
  console.log(`${f(r.id, 42)} ${fr(r.impact, 6)} ${fr(r.flipRate.toFixed(1), 7)} ${fr(r.winnerShare.toFixed(1), 9)} ${fr(r.avgWinner.toFixed(2), 9)} ${fr(r.avgPlayer.toFixed(2), 8)}`);
}
console.log("");
console.log("How to read:");
console.log("- Impact: quick risk label for dominance in final ranking.");
console.log("- Flip%: in how many seasons the winner changes if this question is removed.");
console.log("- Winner%: share of winner's total score coming from this question.");
console.log("- Avg/win: average points winner gets from this question.");
console.log("- Avg/p: average points all players get from this question.");
console.log("- Practical guideline: keep most questions MED/LOW, and only a few HIGH.");
if (cfg.json) fs.writeFileSync(path.resolve(process.cwd(), cfg.json), JSON.stringify({ input: cfg, summary: { avg, std, wAvg }, questions: rows }, null, 2));
