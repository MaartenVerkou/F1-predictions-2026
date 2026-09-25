"use strict";

const CLASSIFIED_STATUS_RE = /^(finished|lapped|lap\s+down|\+\d+\s+lap|\+\d+\.\d+s?)$/i;
const NON_DNF_STATUS_RE = /^(dns|dnq|did not start|did not qualify|dsq|disqualified|nc|not classified|wd|withdrew)$/i;

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function entityMatches(row, entity, { idField, nameField }) {
  if (!row || !entity) return false;
  if (entity.id != null && row[idField] != null) {
    return Number(entity.id) === Number(row[idField]);
  }
  return String(row[nameField] || "") === String(entity.name || "");
}

function isDnfStatus(status) {
  const value = String(status || "").trim();
  if (!value || NON_DNF_STATUS_RE.test(value) || CLASSIFIED_STATUS_RE.test(value)) return false;
  return /^(dnf|retired|retirement|accident|collision|crash|engine|mechanical|gearbox|hydraulic|brake|electrical|damage|overheating|puncture|spin|illness|fuel|technical)/i.test(value)
    || Boolean(value);
}

function roundRows(round, section) {
  return round?.evidence?.payload?.[section]?.rows || [];
}

function findRoundRow(round, entity, section = "race") {
  return roundRows(round, section).find((row) => entityMatches(row, entity, {
    idField: section === "standings" ? "entity_id" : "driver_id",
    nameField: section === "standings" ? "entity" : "driver"
  })) || null;
}

function focusCell(cell, { label, title, hit = false, state = null } = {}) {
  return {
    ...cell,
    label: label == null ? "—" : String(label),
    title: title || cell.title,
    focusHit: Boolean(hit),
    focusColumn: Boolean(cell.focusColumn),
    markerGlyph: "",
    markerTitle: "",
    podiumPosition: null,
    ...(state ? { state } : {})
  };
}

function sprintPointsForDriver(round, entity) {
  return roundRows(round, "sprint")
    .filter((row) => entityMatches(row, entity, { idField: "driver_id", nameField: "driver" }))
    .reduce((total, row) => total + Number(row.points || 0), 0);
}

function qualifyingRowsForTeam(round, team) {
  return roundRows(round, "qualifying")
    .filter((row) => entityMatches(row, team, { idField: "team_id", nameField: "constructor" }))
    .sort((left, right) => (numeric(left.position) || 999) - (numeric(right.position) || 999));
}

function racePointsForDriver(round, entity) {
  return roundRows(round, "race")
    .filter((row) => entityMatches(row, entity, { idField: "driver_id", nameField: "driver" }))
    .reduce((total, row) => total + Number(row.points || 0), 0);
}

function championshipPointsForDriver(round, entity) {
  return racePointsForDriver(round, entity) + sprintPointsForDriver(round, entity);
}

function defaultRaceDataHighlightMode(metric) {
  const normalized = String(metric || "").trim().toLowerCase();
  if (normalized === "dnf_by_race") return "columns";
  if ([
    "championship_top3",
    "last_standing",
    "podiums",
    "dnfs",
    "grid_wins",
    "driver_of_day",
    "sprint_points",
    "sprint_champion_same",
    "teammate_points",
    "ferrari_podium"
  ].includes(normalized)) return "rows";
  return "cells";
}

function inferFocusFooterMode(focus, metric) {
  const declared = String(focus?.footerMode || "").trim().toLowerCase();
  if (["count", "sum", "none"].includes(declared)) return declared === "none" ? null : declared;
  if (["podiums", "dnfs", "driver_of_day", "dnf_by_race", "ferrari_podium"].includes(String(focus?.metric || "").toLowerCase())) return "count";
  if (["podiums", "dnfs", "driver_of_day", "sprint_points"].includes(metric)) {
    return metric === "sprint_points" ? "sum" : "count";
  }
  return null;
}

function buildFocusFooter({ focus, rounds, rows, metric }) {
  const mode = inferFocusFooterMode(focus, metric);
  if (!mode) return null;
  const roundLabel = String(focus?.footerRoundLabel || "Round total");
  const totalLabel = String(focus?.footerTotalLabel || "Through cutoff");
  const cells = (rounds || []).map((round, index) => {
    if (round.afterCutoff) {
      return {
        label: "—",
        value: null,
        state: "future",
        afterCutoff: true,
        focusColumn: false,
        title: "After selected cutoff"
      };
    }
    if (!round.evidence || round.state === "cancelled") {
      return {
        label: "—",
        value: null,
        state: round.state || "not_synced",
        afterCutoff: false,
        focusColumn: Boolean(round.focusColumn),
        title: round.evidence ? "No contribution for this round" : "Evidence unavailable"
      };
    }
    let total = 0;
    let observed = false;
    (rows || []).forEach((row) => {
      const value = numeric(row.cells?.[index]?.label);
      if (value == null) return;
      total += value;
      observed = true;
    });
    return {
      label: observed ? String(total) : "—",
      value: observed ? total : null,
      state: round.state,
      afterCutoff: false,
      focusColumn: Boolean(round.focusColumn),
      title: observed
        ? (mode === "count" ? "Observed count through this round" : "Observed points through this round")
        : "No matching values in this round"
    };
  });
  const total = cells.reduce((sum, cell) => (
    cell.afterCutoff || cell.value == null ? sum : sum + Number(cell.value)
  ), 0);
  const hasTotal = cells.some((cell) => !cell.afterCutoff && cell.value != null);
  return {
    mode,
    label: roundLabel,
    totalLabel,
    total: hasTotal ? total : null,
    cells
  };
}

function applyDriverMetric(row, rounds, focus, cutoffRoundNumber) {
  const metric = String(focus.matrixMetric || focus.metric || "points");
  const teammatePointsFocus = String(focus.metric || "").toLowerCase() === "teammate_points";
  const highlightCells = focus.highlightMode === "cells";
  if (!["podiums", "dnfs", "grid_wins", "driver_of_day", "sprint_points"].includes(metric) && !teammatePointsFocus) return row;

  let count = 0;
  let sprintTotal = 0;
  let worstWinningGrid = null;
  let worstWinningGridLabel = null;
  const cells = row.cells.map((cell, index) => {
    const round = rounds[index];
    const inCutoff = !cell.afterCutoff;
    if (!round?.evidence) {
      return focusCell(cell, { label: "—", title: "Evidence unavailable", hit: false });
    }
    const race = findRoundRow(round, { id: row.id, name: row.name }, "race");
    if (teammatePointsFocus) {
      const raceRow = findRoundRow(round, { id: row.id, name: row.name }, "race");
      const sprintRows = roundRows(round, "sprint");
      const hasDriverEvidence = Boolean(raceRow)
        || sprintRows.some((item) => entityMatches(item, { id: row.id, name: row.name }, { idField: "driver_id", nameField: "driver" }));
      if (!hasDriverEvidence) {
        return focusCell(cell, { label: "—", title: "No points row in this round", hit: false });
      }
      const points = championshipPointsForDriver(round, { id: row.id, name: row.name });
      const comparedDrivers = (focus.compareDrivers || focus.options || []).map((value) => String(value));
      const hit = comparedDrivers.includes(String(row.name));
      return focusCell(cell, {
        label: points,
        hit: focus.highlightMode === "rows" ? false : inCutoff && hit,
        title: row.name + ": " + points + " championship points"
      });
    }
    if (metric === "podiums") {
      if (!race) return focusCell(cell, { label: "—", title: "No race row", hit: false });
      const podium = [1, 2, 3].includes(numeric(race.position));
      if (podium && inCutoff) count += 1;
      return focusCell(cell, {
        label: podium ? "1" : "0",
        hit: highlightCells && inCutoff && podium,
        title: podium ? "Podium finish" : "No podium finish"
      });
    }
    if (metric === "dnfs") {
      if (!race) return focusCell(cell, { label: "—", title: "No race row", hit: false });
      const dnf = isDnfStatus(race.status);
      if (dnf && inCutoff) count += 1;
      return focusCell(cell, {
        label: dnf ? "1" : "0",
        hit: highlightCells && inCutoff && dnf,
        title: `${race.status || "Unclassified status"} · ${dnf ? "DNF" : "Classified / excluded from DNF"}`
      });
    }
    if (metric === "grid_wins") {
      const position = numeric(race?.position);
      if (position !== 1) return focusCell(cell, { label: "—", title: "Not a race win", hit: false });
      const grid = numeric(race?.grid);
      const gridLabel = grid === 0 ? "PL" : grid == null ? "—" : String(grid);
      if (grid != null && inCutoff) {
        const comparableGrid = grid === 0 ? 23 : grid;
        if (worstWinningGrid == null || comparableGrid > worstWinningGrid) {
          worstWinningGrid = comparableGrid;
          worstWinningGridLabel = gridLabel;
        }
      }
      if (inCutoff) count += 1;
      return focusCell(cell, {
        label: gridLabel,
        hit: highlightCells && inCutoff,
        title: `${row.name} won from grid ${gridLabel}`
      });
    }
    if (metric === "driver_of_day") {
      const award = round.evidence.payload?.external?.driverOfTheDay;
      if (!award) return focusCell(cell, { label: "—", title: "Driver of the Day evidence unavailable", hit: false, state: "incomplete" });
      const hit = String(award) === String(row.name);
      if (hit && inCutoff) count += 1;
      return focusCell(cell, {
        label: hit ? "1" : "0",
        hit: highlightCells && inCutoff && hit,
        title: hit ? "Driver of the Day" : `Driver of the Day: ${award}`
      });
    }
    const sprintRows = roundRows(round, "sprint");
    const hasSprintEvidence = sprintRows.length > 0;
    const points = sprintPointsForDriver(round, { id: row.id, name: row.name });
    if (inCutoff) sprintTotal += points;
    return focusCell(cell, {
      label: hasSprintEvidence ? points : "—",
      hit: highlightCells && inCutoff && hasSprintEvidence && points > 0,
      title: hasSprintEvidence ? `${points} sprint points` : "No sprint result in this round"
    });
  });

  row.cells = cells;
  if (teammatePointsFocus) {
    const comparedDrivers = (focus.compareDrivers || focus.options || []).map((value) => String(value));
    row.focusRow = focus.highlightMode === "rows" && comparedDrivers.includes(String(row.name));
    row.summaryValue = row.points ?? null;
  } else if (metric === "podiums" && focus.highlightMode === "rows") {
    row.focusRow = count > 0;
    row.focusSortValue = row.points ?? null;
  } else if (metric === "grid_wins") {
    if (focus.highlightMode === "rows") row.focusRow = count > 0;
    row.summaryValue = worstWinningGrid;
    row.summaryLabel = worstWinningGridLabel || "—";
    row.focusSortValue = worstWinningGrid == null ? -1 : worstWinningGrid;
  } else {
    row.summaryValue = metric === "sprint_points" ? sprintTotal : count;
    row.focusSortValue = row.summaryValue;
  }
  row.focusMeta = { count, sprintTotal, worstWinningGrid, worstWinningGridLabel };
  return row;
}

function applyDriverPointsMetric(row, rounds) {
  row.cells = (row.cells || []).map((cell, index) => {
    const round = rounds[index];
    if (!round?.evidence) {
      return focusCell(cell, {
        label: "—",
        title: "Evidence unavailable",
        hit: false
      });
    }

    const entity = { id: row.id, name: row.name };
    const raceRows = roundRows(round, "race")
      .filter((candidate) => entityMatches(candidate, entity, { idField: "driver_id", nameField: "driver" }));
    const sprintRows = roundRows(round, "sprint")
      .filter((candidate) => entityMatches(candidate, entity, { idField: "driver_id", nameField: "driver" }));
    const hasEvidence = raceRows.length > 0 || sprintRows.length > 0;
    if (!hasEvidence) {
      return focusCell(cell, {
        label: "—",
        title: "No driver row in this round",
        hit: false
      });
    }

    const points = [...raceRows, ...sprintRows]
      .reduce((total, candidate) => total + Number(candidate.points || 0), 0);
    return focusCell(cell, {
      label: points,
      title: row.name + ": " + points + " championship points",
      hit: false
    });
  });
  row.summaryValue = row.points ?? null;
  row.focusSortValue = row.points ?? null;
  return row;
}

function applyConstructorMetric(row, rounds, focus, cutoffRoundNumber, driverRows = []) {
  const metric = String(focus.matrixMetric || focus.metric || "points");
  if (metric !== "qualifying_h2h") return row;

  const teamDrivers = driverRows
    .filter((driver) => String(driver.constructor || "") === String(row.name || ""))
    .sort((left, right) => (Number(left.seatNumber) || 999) - (Number(right.seatNumber) || 999));
  const left = teamDrivers[0] || null;
  const right = teamDrivers[1] || null;
  if (focus.highlightMode === "rows") {
    if (left) left.focusRow = true;
    if (right) right.focusRow = true;
  }
  let leftWins = 0;
  let rightWins = 0;
  let racesCompared = 0;
  const applySeatCell = (driver, index, label, title, hit = false, state) => {
    if (!driver?.cells?.[index]) return;
    driver.cells[index] = focusCell(driver.cells[index], {
      label,
      title,
      hit,
      ...(state ? { state } : {})
    });
  };
  row.cells = row.cells.map((cell, index) => {
    const round = rounds[index];
    const inCutoff = !cell.afterCutoff;
    if (!round?.evidence || !left || !right) {
      applySeatCell(left, index, "—", "Two qualifying rows required");
      applySeatCell(right, index, "—", "Two qualifying rows required");
      return focusCell(cell, { label: "—", title: "Two qualifying rows required", hit: false });
    }
    const qualifying = roundRows(round, "qualifying");
    const leftRow = qualifying.find((candidate) => String(candidate.driver || "") === String(left.name || ""));
    const rightRow = qualifying.find((candidate) => String(candidate.driver || "") === String(right.name || ""));
    const leftPosition = numeric(leftRow?.position);
    const rightPosition = numeric(rightRow?.position);
    if (leftPosition == null || rightPosition == null) {
      applySeatCell(left, index, "—", "Incomplete qualifying comparison", false, "incomplete");
      applySeatCell(right, index, "—", "Incomplete qualifying comparison", false, "incomplete");
      return focusCell(cell, { label: "—", title: "Incomplete qualifying comparison", hit: false, state: "incomplete" });
    }
    if (inCutoff) {
      racesCompared += 1;
      if (leftPosition < rightPosition) leftWins += 1;
      if (rightPosition < leftPosition) rightWins += 1;
    }
    const winner = leftPosition === rightPosition
      ? "Tie"
      : leftPosition < rightPosition ? left.name : right.name;
    const comparisonTitle = `${left.name} ${leftPosition} · ${right.name} ${rightPosition} · ${winner}`;
    const leftIsBest = focus.highlightMode === "cells" && inCutoff && leftPosition < rightPosition;
    const rightIsBest = focus.highlightMode === "cells" && inCutoff && rightPosition < leftPosition;
    applySeatCell(left, index, leftPosition, comparisonTitle, leftIsBest);
    applySeatCell(right, index, rightPosition, comparisonTitle, rightIsBest);
    return focusCell(cell, {
      label: `${leftPosition}–${rightPosition}`,
      hit: false,
      title: comparisonTitle
    });
  });
  row.summaryValue = Math.abs(leftWins - rightWins);
  row.focusSortValue = row.summaryValue;
  row.focusMeta = { left: left?.name || null, right: right?.name || null, leftWins, rightWins, racesCompared };
  return row;
}

function sortLastStandingRows(rows) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftPoints = numeric(left.row.points);
      const rightPoints = numeric(right.row.points);
      if (leftPoints == null && rightPoints != null) return 1;
      if (leftPoints != null && rightPoints == null) return -1;
      if (leftPoints != null && rightPoints != null && leftPoints !== rightPoints) {
        return leftPoints - rightPoints;
      }

      const leftPosition = numeric(left.row.championshipPosition);
      const rightPosition = numeric(right.row.championshipPosition);
      if (leftPosition == null && rightPosition != null) return 1;
      if (leftPosition != null && rightPosition == null) return -1;
      if (leftPosition != null && rightPosition != null && leftPosition !== rightPosition) {
        return rightPosition - leftPosition;
      }
      return left.index - right.index;
    })
    .map(({ row }) => row);
}

function sortFocusRows(rows, direction = "desc") {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftValue = numeric(left.row.focusSortValue ?? left.row.summaryValue ?? left.row.points);
      const rightValue = numeric(right.row.focusSortValue ?? right.row.summaryValue ?? right.row.points);
      if (leftValue == null && rightValue != null) return 1;
      if (leftValue != null && rightValue == null) return -1;
      if (leftValue != null && rightValue != null && leftValue !== rightValue) {
        return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
      }
      const leftPosition = numeric(left.row.championshipPosition);
      const rightPosition = numeric(right.row.championshipPosition);
      if (leftPosition != null && rightPosition != null && leftPosition !== rightPosition) {
        return leftPosition - rightPosition;
      }
      return left.index - right.index;
    })
    .map(({ row }) => row);
}

function markFocusRows({ focus, drivers, constructors }) {
  if (focus.highlightMode !== "rows") return;
  const metric = String(focus.metric || "").trim().toLowerCase();
  const matrixMetric = String(focus.matrixMetric || "").trim().toLowerCase();
  const rows = focus.view === "constructors" ? constructors : drivers;

  if (metric === "championship_top3") {
    rows.slice(0, 3).forEach((row) => { row.focusRow = true; });
    return;
  }
  if (metric === "last_standing") {
    rows.slice(0, 1).forEach((row) => { row.focusRow = true; });
    return;
  }
  if (["dnfs", "driver_of_day", "sprint_points"].includes(matrixMetric)) {
    const values = rows
      .map((row) => numeric(row.summaryValue))
      .filter((value) => value != null);
    const topValue = values.length ? Math.max(...values) : null;
    if (topValue == null || topValue <= 0) return;
    rows.forEach((row) => {
      row.focusRow = numeric(row.summaryValue) === topValue;
    });
    return;
  }
  if (metric === "ferrari_podium") {
    rows.forEach((row) => {
      row.focusRow = String(row.constructor || "") === "Ferrari";
    });
  }
}

function markFocusColumns({ focus, rounds, drivers, constructors }) {
  if (focus.highlightMode !== "columns" || String(focus.metric || "").toLowerCase() !== "dnf_by_race") {
    return [];
  }
  const rows = focus.view === "constructors" ? constructors : drivers;
  const candidates = (rounds || []).map((round, index) => {
    if (round.afterCutoff || !round.evidence || round.state === "cancelled") return null;
    const count = rows.reduce((total, row) => (
      total + (row.cells?.[index]?.label === "1" ? 1 : 0)
    ), 0);
    return { round, index, count };
  }).filter(Boolean);
  const selected = candidates
    .filter(({ count }) => count > 0)
    .sort((left, right) => right.count - left.count || left.round.roundNumber - right.round.roundNumber)
    .slice(0, 3);
  selected.forEach(({ round, index }, rank) => {
    round.focusColumn = true;
    round.focusColumnRank = rank + 1;
    rows.forEach((row) => {
      const cell = row.cells?.[index];
      if (!cell) return;
      row.cells[index] = { ...cell, focusColumn: true, focusHit: false };
    });
  });
  return selected.map(({ round, count }) => ({ roundNumber: round.roundNumber, count }));
}

function completedRounds(rounds) {
  return (rounds || []).filter((round) => !round.afterCutoff && round.evidence && round.state !== "cancelled");
}

function formatNames(names) {
  const values = (names || []).filter(Boolean);
  if (values.length <= 3) return values.join(", ");
  return `${values.slice(0, 3).join(", ")} +${values.length - 3}`;
}

function buildFocusSummary({ focus, rounds, drivers, constructors, cutoffRoundNumber, roster }) {
  const metric = String(focus.metric || "points");
  const completed = completedRounds(rounds);
  const base = {
    status: completed.length ? "ready" : "unavailable",
    value: "—",
    detail: "",
    tooltip: "",
    sourceCount: completed.length
  };
  const unavailable = (detail) => ({
    ...base,
    status: "unavailable",
    detail,
    tooltip: detail
  });

  if (metric === "points") return null;
  if (metric === "championship_top3") {
    const rows = [...(focus.view === "constructors" ? constructors : drivers)]
      .filter((row) => Number.isFinite(Number(row.championshipPosition)))
      .sort((left, right) => Number(left.championshipPosition) - Number(right.championshipPosition))
      .slice(0, 3);
    if (!rows.length) return unavailable("Standings are not available for this cutoff.");
    return {
      ...base,
      value: rows.map((row) => row.name).join(" · "),
      detail: `Top 3 through R${cutoffRoundNumber}`,
      tooltip: rows.map((row) => `P${row.championshipPosition} ${row.name}: ${row.points ?? "—"} points`).join(" · ")
    };
  }
  if (metric === "last_standing") {
    const rows = [...(focus.view === "constructors" ? constructors : drivers)]
      .filter((row) => Number.isFinite(Number(row.championshipPosition)));
    const last = sortLastStandingRows(rows)[0];
    if (!last) return unavailable("Standings are not available for this cutoff.");
    return {
      ...base,
      value: `${last.name} · P${last.championshipPosition}`,
      detail: `Last classified standing through R${cutoffRoundNumber}`,
      tooltip: `${last.name}: ${last.points ?? "—"} points`
    };
  }
  if (["damage", "engine_switch"].includes(metric)) {
    return unavailable(metric === "damage"
      ? "Damage evidence is not part of the normalized race bundle yet."
      : "This question requires an external announcement source.");
  }

  if (metric === "podiums" || metric === "dnfs" || metric === "driver_of_day" || metric === "sprint_points") {
    const ordered = [...drivers].sort((a, b) => Number(b.summaryValue ?? -1) - Number(a.summaryValue ?? -1));
    const topValue = Number(ordered[0]?.summaryValue);
    const leaders = ordered.filter((row) => Number(row.summaryValue) === topValue && Number.isFinite(topValue));
    const label = metric === "podiums" ? "podium finishes"
      : metric === "dnfs" ? "DNFs"
        : metric === "driver_of_day" ? "Driver of the Day awards"
          : "sprint points";
    if (!leaders.length || !Number.isFinite(topValue)) return unavailable("No matching evidence yet.");
    const partial = metric === "driver_of_day"
      && completed.some((round) => !round.evidence.payload?.external?.driverOfTheDay);
    return {
      ...base,
      status: partial ? "partial" : "ready",
      value: `${formatNames(leaders.map((row) => row.name))} · ${topValue}`,
      detail: `${label} through R${cutoffRoundNumber}`,
      tooltip: `${leaders.map((row) => `${row.name}: ${row.summaryValue}`).join(" · ")}`
    };
  }

  if (metric === "grid_wins") {
    const wins = [];
    completed.forEach((round) => {
      const race = roundRows(round, "race").find((row) => numeric(row.position) === 1);
      if (!race) return;
      const grid = numeric(race.grid);
      if (grid == null) return;
      wins.push({ round, driver: race.driver, grid: grid === 0 ? "Pitlane" : String(grid), comparable: grid === 0 ? 23 : grid });
    });
    if (!wins.length) return unavailable("No race winner with a known grid position yet.");
    const worst = wins.reduce((best, item) => item.comparable > best.comparable ? item : best, wins[0]);
    return {
      ...base,
      value: `${worst.grid} · ${worst.driver}`,
      detail: `Worst winning grid · R${worst.round.roundNumber}`,
      tooltip: wins.map((item) => `R${item.round.roundNumber} ${item.driver}: grid ${item.grid}`).join(" · ")
    };
  }

  if (metric === "qualifying_h2h") {
    const candidates = constructors.filter((row) => row.focusMeta?.racesCompared > 0);
    if (!candidates.length) return unavailable("Two comparable qualifying rows are required.");
    const best = candidates.reduce((current, row) => row.summaryValue < current.summaryValue ? row : current, candidates[0]);
    return {
      ...base,
      value: `${best.name} · ${best.summaryValue}`,
      detail: `Qualifying win-gap · ${best.focusMeta.leftWins}–${best.focusMeta.rightWins}`,
      tooltip: `${best.focusMeta.left} ${best.focusMeta.leftWins} · ${best.focusMeta.right} ${best.focusMeta.rightWins} · ${best.focusMeta.racesCompared} comparisons`
    };
  }

  if (metric === "no_podium_points") {
    const candidates = constructors.filter((row) => Number(row.podiumSummary?.podiums || 0) === 0 && Number.isFinite(Number(row.points)));
    if (!candidates.length) {
      return { ...base, value: "All teams scored a podium", detail: "No constructor without a Grand Prix podium", tooltip: "The special answer is available only when every team has a podium." };
    }
    const best = candidates.reduce((current, row) => Number(row.points) > Number(current.points) ? row : current, candidates[0]);
    return { ...base, value: `${best.name} · ${best.points}`, detail: "Most points without a podium", tooltip: candidates.map((row) => `${row.name}: ${row.points} points`).join(" · ") };
  }

  if (metric === "teammate_points") {
    const options = focus.options || [];
    const left = drivers.find((row) => row.name === options[0]);
    const right = drivers.find((row) => row.name === options[1]);
    if (!left || !right || left.points == null || right.points == null) return unavailable("Both teammate standings are required.");
    const difference = Math.abs(Number(left.points) - Number(right.points));
    const winner = Number(left.points) === Number(right.points) ? "Tie" : Number(left.points) > Number(right.points) ? left.name : right.name;
    return { ...base, value: `${winner} · Δ ${difference}`, detail: `${left.name} ${left.points} · ${right.name} ${right.points} points`, tooltip: "Difference uses the selected round cutoff." };
  }

  if (metric === "alpine_comparison") {
    const teamMap = new Map(constructors.map((row) => [row.name, row]));
    const alpine = teamMap.get("Alpine");
    const comparisonNames = ["Cadillac", "Audi", "Aston Martin"];
    const comparison = comparisonNames.map((name) => teamMap.get(name)).filter(Boolean);
    if (!alpine || !comparison.length) return unavailable("The comparison teams are not resolved for this season.");
    const combined = comparison.reduce((sum, row) => sum + Number(row.points || 0), 0);
    const delta = Number(alpine.points || 0) - combined;
    return { ...base, value: delta >= 0 ? "More" : "Less", detail: `Alpine ${alpine.points} · combined ${combined} · Δ ${Math.abs(delta)}`, tooltip: comparison.map((row) => `${row.name}: ${row.points}`).join(" · ") };
  }

  if (metric === "dnf_by_race") {
    const counts = completed.map((round) => ({
      round,
      count: roundRows(round, "race").filter((row) => isDnfStatus(row.status)).length
    })).sort((left, right) => right.count - left.count);
    if (!counts.length) return unavailable("No race evidence yet.");
    const top = counts.filter((item) => item.count > 0).slice(0, 3);
    if (!top.length) return unavailable("No DNFs recorded yet.");
    return { ...base, value: top.map((item) => `R${item.round.roundNumber}: ${item.count}`).join(" · "), detail: "DNFs by race", tooltip: top.map((item) => `${item.round.label}: ${item.count} DNFs`).join(" · ") };
  }

  if (metric === "title_decision") {
    const selected = rounds.find((round) => round.roundNumber === cutoffRoundNumber);
    const leader = selected?.evidence?.payload?.standings?.drivers?.[0];
    const runnerUp = selected?.evidence?.payload?.standings?.drivers?.[1];
    if (!leader) return unavailable("Driver standings are not available for this cutoff.");
    const gap = runnerUp ? Number(leader.points || 0) - Number(runnerUp.points || 0) : null;
    return { ...base, status: cutoffRoundNumber < (rounds.length || cutoffRoundNumber) ? "partial" : "ready", value: leader.entity, detail: `Leader after R${cutoffRoundNumber}${gap == null ? "" : ` · gap ${gap}`}`, tooltip: "A title decision is only final once all required completed rounds are available." };
  }

  if (metric === "all_teams_points") {
    const withPoints = constructors.filter((row) => Number(row.points || 0) > 0).length;
    const total = constructors.length;
    return { ...base, value: `${withPoints}/${total}`, detail: withPoints === total ? "Every team has scored" : `${total - withPoints} team(s) without points`, tooltip: constructors.filter((row) => Number(row.points || 0) <= 0).map((row) => row.name).join(", ") || "All teams have points" };
  }

  if (metric === "race1_champion") {
    const firstRound = rounds.find((round) => round.roundNumber === 1 && !round.afterCutoff);
    const winner = roundRows(firstRound, "race").find((row) => numeric(row.position) === 1)?.driver || null;
    const champion = drivers.find((row) => Number(row.championshipPosition) === 1)?.name || null;
    if (!winner || !champion) return unavailable("Race winner and championship leader are required.");
    return { ...base, value: winner === champion ? "Yes" : "No", detail: `R1 ${winner} · leader ${champion}`, tooltip: "Compares the first Grand Prix winner with the selected-cutoff championship leader." };
  }

  if (metric === "engine_top5") {
    const topFive = constructors.filter((row) => Number(row.championshipPosition) >= 1 && Number(row.championshipPosition) <= 5);
    const mercedes = topFive.filter((row) => String(row.powerUnit || "").toLowerCase() === "mercedes").length;
    return { ...base, value: `${mercedes}/${topFive.length}`, detail: "Mercedes power units in top five", tooltip: topFive.map((row) => `${row.name}: ${row.powerUnit || "PU unknown"}`).join(" · ") };
  }

  if (metric === "ferrari_podium") {
    const ferrariDrivers = drivers.filter((row) => String(row.constructor || "") === "Ferrari");
    if (!ferrariDrivers.length) return unavailable("Ferrari drivers are not resolved for this round.");
    const both = ferrariDrivers.length >= 2 && ferrariDrivers.every((row) => Number(row.summaryValue || 0) > 0);
    return { ...base, value: both ? "Yes" : "No", detail: ferrariDrivers.map((row) => `${row.name}: ${row.summaryValue || 0}`).join(" · "), tooltip: "Both Ferrari seats must have at least one Grand Prix podium." };
  }

  if (metric === "sprint_champion_same") {
    const sprintTotals = new Map();
    completed.forEach((round) => roundRows(round, "sprint").forEach((item) => {
      sprintTotals.set(item.driver, (sprintTotals.get(item.driver) || 0) + Number(item.points || 0));
    }));
    const sprintChampion = [...sprintTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const normalChampion = drivers.find((row) => Number(row.championshipPosition) === 1)?.name || null;
    if (!sprintChampion || !normalChampion) return unavailable("Sprint points and championship standings are required.");
    return { ...base, value: sprintChampion === normalChampion ? "Yes" : "No", detail: `Sprint ${sprintChampion} · championship ${normalChampion}`, tooltip: "Sprint-only points are compared with the selected-cutoff championship leader." };
  }

  return unavailable("This focus has no projection yet.");
}

function applyRaceDataFocus({ focus, rounds, driverRows, constructorRows, cutoffRoundNumber }) {
  const metric = String(focus?.matrixMetric || focus?.metric || "points");
  const lastStandingFocus = String(focus?.metric || "").toLowerCase() === "last_standing";
  const focusMetric = String(focus?.metric || "").toLowerCase();
  const highlightMode = String(
    focus?.highlightMode || defaultRaceDataHighlightMode(focusMetric)
  ).trim().toLowerCase();
  const resolvedFocus = { ...focus, matrixMetric: metric, highlightMode };
  const nextDrivers = driverRows.map((row) => applyDriverMetric(row, rounds, resolvedFocus, cutoffRoundNumber));
  const nextConstructors = constructorRows.map((row) => applyConstructorMetric(row, rounds, resolvedFocus, cutoffRoundNumber, nextDrivers));
  const direction = focus?.sort === "asc" ? "asc" : "desc";
  const sortedDrivers = lastStandingFocus
    ? sortLastStandingRows(nextDrivers)
    : sortFocusRows(nextDrivers, direction);
  const sortedConstructors = lastStandingFocus
    ? sortLastStandingRows(nextConstructors)
    : sortFocusRows(nextConstructors, direction);
  const focusColumns = markFocusColumns({
    focus: resolvedFocus,
    rounds,
    drivers: sortedDrivers,
    constructors: sortedConstructors
  });
  markFocusRows({
    focus: resolvedFocus,
    drivers: sortedDrivers,
    constructors: sortedConstructors
  });
  const rowsForFooter = resolvedFocus.view === "constructors" ? sortedConstructors : sortedDrivers;
  return {
    drivers: sortedDrivers,
    constructors: sortedConstructors,
    summary: buildFocusSummary({ focus: resolvedFocus, rounds, drivers: sortedDrivers, constructors: sortedConstructors, cutoffRoundNumber }),
    footer: buildFocusFooter({
      focus: resolvedFocus,
      rounds,
      rows: rowsForFooter,
      metric
    }),
    focusColumns,
    metric
  };
}

module.exports = {
  applyRaceDataFocus,
  applyDriverPointsMetric,
  defaultRaceDataHighlightMode,
  buildFocusSummary,
  isDnfStatus,
  sortFocusRows
};
