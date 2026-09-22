"use strict";

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error("Identifiers must be positive integers.");
  return number;
}

function activeAssignment(assignments, teamId, seatNumber, roundNumber) {
  return assignments
    .filter((assignment) => Number(assignment.team_id) === Number(teamId)
      && Number(assignment.seat_number || 1) === Number(seatNumber)
      && Number(assignment.from_round) <= roundNumber
      && (assignment.to_round == null || Number(assignment.to_round) >= roundNumber))
    .sort((left, right) => Number(right.from_round) - Number(left.from_round))[0] || null;
}

function driverName(drivers, driverId) {
  const driver = drivers.find((entry) => Number(entry.id) === Number(driverId));
  return driver ? (driver.display_name_override || driver.display_name || driver.name || `Driver ${driverId}`) : null;
}

function teamName(team) {
  return team.display_name_override || team.display_name || team.name || `Team ${team.id}`;
}

function assertAssignmentIntervals(assignments = []) {
  const normalized = assignments.map((assignment) => {
    const fromRound = Number(assignment.from_round);
    const toRound = assignment.to_round == null || assignment.to_round === ""
      ? null
      : Number(assignment.to_round);
    const seatNumber = Number(assignment.seat_number || 1);
    if (!Number.isInteger(fromRound) || fromRound < 1) {
      throw new Error(`Assignment ${assignment.id || "new"} must start at a positive round.`);
    }
    if (toRound != null && (!Number.isInteger(toRound) || toRound < fromRound)) {
      throw new Error(`Assignment ${assignment.id || "new"} has an invalid end round.`);
    }
    if (![1, 2].includes(seatNumber)) {
      throw new Error(`Assignment ${assignment.id || "new"} must use seat 1 or 2.`);
    }
    return {
      ...assignment,
      fromRound,
      toRound,
      seatNumber,
      driverId: Number(assignment.driver_id),
      teamId: Number(assignment.team_id)
    };
  });
  const overlaps = (left, right) => left.fromRound <= (right.toRound ?? Number.MAX_SAFE_INTEGER)
    && right.fromRound <= (left.toRound ?? Number.MAX_SAFE_INTEGER);
  for (let index = 0; index < normalized.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < normalized.length; otherIndex += 1) {
      const left = normalized[index];
      const right = normalized[otherIndex];
      if (left.driverId === right.driverId && overlaps(left, right)) {
        throw new Error(`Driver ${left.driverId} has overlapping team assignments.`);
      }
      if (left.teamId === right.teamId && left.seatNumber === right.seatNumber && overlaps(left, right)) {
        throw new Error(`Team ${left.teamId} seat ${left.seatNumber} has overlapping assignments.`);
      }
    }
  }
  return normalized;
}

function buildLineupProjection({ teams = [], drivers = [], assignments = [], roundNumber }) {
  const round = Number(roundNumber);
  if (!Number.isInteger(round) || round < 1) throw new Error("Round number must be a positive integer.");
  assertAssignmentIntervals(assignments);
  return [...teams]
    .filter((team) => team.active == null || Number(team.active) === 1 || team.active === true)
    .sort((left, right) => Number(left.display_order || 9999) - Number(right.display_order || 9999)
      || teamName(left).localeCompare(teamName(right)))
    .map((team) => ({
      teamId: Number(team.id),
      teamName: teamName(team),
      displayOrder: Number(team.display_order || 0),
      seats: [1, 2].map((seatNumber) => {
        const assignment = activeAssignment(assignments, team.id, seatNumber, round);
        return {
          seatNumber,
          driverId: assignment ? Number(assignment.driver_id) : null,
          driverName: assignment ? driverName(drivers, assignment.driver_id) : null,
          assignmentId: assignment ? Number(assignment.id) : null,
          fromRound: assignment ? Number(assignment.from_round) : null,
          toRound: assignment && assignment.to_round != null ? Number(assignment.to_round) : null
        };
      })
    }));
}

function buildTeamLineupHistory({ teams = [], drivers = [], assignments = [] }) {
  const normalizedAssignments = assertAssignmentIntervals(assignments);
  const sortedTeams = [...teams]
    .filter((team) => team.active == null || Number(team.active) === 1 || team.active === true)
    .sort((left, right) => Number(left.display_order || 9999) - Number(right.display_order || 9999)
      || teamName(left).localeCompare(teamName(right)));
  return sortedTeams.map((team) => {
    const teamAssignments = normalizedAssignments
      .filter((assignment) => assignment.teamId === Number(team.id))
      .sort((left, right) => left.seatNumber - right.seatNumber
        || left.fromRound - right.fromRound
        || Number(left.id || 0) - Number(right.id || 0));
    const seats = [1, 2].reduce((result, seatNumber) => {
      result[seatNumber] = teamAssignments
        .filter((assignment) => assignment.seatNumber === seatNumber)
        .map((assignment) => ({
          id: assignment.id == null ? null : Number(assignment.id),
          seatNumber,
          driverId: assignment.driverId,
          driverName: driverName(drivers, assignment.driverId),
          fromRound: assignment.fromRound,
          toRound: assignment.toRound,
          source: assignment.source || null
        }));
      return result;
    }, {});
    return {
      teamId: Number(team.id),
      teamName: teamName(team),
      displayOrder: Number(team.display_order || 0),
      active: team.active == null || Number(team.active) === 1 || team.active === true,
      seats
    };
  });
}

function optionalPositiveInteger(value, label) {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${label} must be a positive integer.`);
  return number;
}

function normalizeTeamHistoryPeriods({ teamId, seatNumber, periods = [], driverIds, seasonRoundCount }) {
  const maxRound = Number(seasonRoundCount);
  if (!Number.isInteger(maxRound) || maxRound < 1) throw new Error("The season has no valid rounds.");
  return periods.map((period, index) => {
    const id = optionalPositiveInteger(period.id ?? period.assignmentId ?? period.assignment_id, "Assignment id");
    const driverId = optionalPositiveInteger(period.driverId ?? period.driver_id, "Driver");
    const fromRound = optionalPositiveInteger(period.fromRound ?? period.from_round, "From round");
    const toRound = optionalPositiveInteger(period.toRound ?? period.to_round, "To round");
    const hasAnyValue = id != null || driverId != null || fromRound != null || toRound != null;
    if (!hasAnyValue) return null;
    if (driverId == null || fromRound == null) {
      throw new Error(`Seat ${seatNumber} period ${index + 1} needs a driver and start round.`);
    }
    if (fromRound > maxRound || (toRound != null && toRound > maxRound)) {
      throw new Error(`Seat ${seatNumber} period ${index + 1} must use rounds in this season.`);
    }
    if (toRound != null && toRound < fromRound) {
      throw new Error(`Seat ${seatNumber} period ${index + 1} ends before it starts.`);
    }
    if (!driverIds.has(driverId)) throw new Error(`Driver ${driverId} is not part of this season.`);
    return {
      id,
      seasonId: null,
      driverId,
      driver_id: driverId,
      teamId: Number(teamId),
      team_id: Number(teamId),
      seatNumber: Number(seatNumber),
      seat_number: Number(seatNumber),
      fromRound,
      from_round: fromRound,
      toRound,
      to_round: toRound
    };
  }).filter(Boolean);
}

function buildTeamLineupHistoryPlan({
  teams = [],
  drivers = [],
  assignments = [],
  teamId,
  seatPeriods = {},
  seasonRoundCount,
  source = "admin-team-lineup"
}) {
  const safeTeamId = optionalPositiveInteger(teamId, "Team");
  const teamIds = new Set(teams.map((team) => Number(team.id)));
  if (!teamIds.has(safeTeamId)) throw new Error(`Team ${safeTeamId} is not part of this season.`);
  const normalizedAssignments = assertAssignmentIntervals(assignments);
  const existing = normalizedAssignments.filter((assignment) => assignment.teamId === safeTeamId);
  const existingById = new Map(existing.filter((assignment) => assignment.id != null).map((assignment) => [Number(assignment.id), assignment]));
  const driverIds = new Set(drivers.map((driver) => Number(driver.id)));
  const desired = [1, 2].flatMap((seatNumber) => normalizeTeamHistoryPeriods({
    teamId: safeTeamId,
    seatNumber,
    periods: seatPeriods[seatNumber] || seatPeriods[String(seatNumber)] || [],
    driverIds,
    seasonRoundCount
  }));
  const desiredIds = new Set();
  desired.forEach((period) => {
    if (period.id != null) {
      if (desiredIds.has(period.id)) throw new Error(`Assignment ${period.id} is listed more than once.`);
      if (!existingById.has(period.id)) throw new Error(`Assignment ${period.id} does not belong to this team.`);
      desiredIds.add(period.id);
    }
  });
  const candidate = normalizedAssignments
    .filter((assignment) => assignment.teamId !== safeTeamId)
    .concat(desired);
  assertAssignmentIntervals(candidate);
  const operations = [];
  existing.forEach((assignment) => {
    if (!desiredIds.has(Number(assignment.id))) operations.push({
      type: "delete",
      assignmentId: Number(assignment.id),
      fromRound: assignment.fromRound,
      toRound: assignment.toRound
    });
  });
  desired.forEach((period) => {
    if (period.id == null) {
      operations.push({ type: "insert", ...period, source });
      return;
    }
    const current = existingById.get(period.id);
    if (Number(current.driverId) !== Number(period.driverId)
      || Number(current.seatNumber) !== Number(period.seatNumber)
      || Number(current.fromRound) !== Number(period.fromRound)
      || (current.toRound == null ? null : Number(current.toRound)) !== period.toRound) {
      operations.push({ type: "update", ...period, source, assignmentId: period.id, previous: current });
    }
  });
  const affectedRounds = operations.flatMap((operation) => [operation.fromRound, operation.previous?.fromRound, operation.toRound, operation.previous?.toRound])
    .filter((round) => Number.isInteger(Number(round)) && Number(round) > 0)
    .map(Number);
  return {
    teamId: safeTeamId,
    desired,
    operations,
    affectedFromRound: affectedRounds.length ? Math.min(...affectedRounds) : null,
    source
  };
}

function applyTeamLineupHistory(db, {
  seasonId,
  teamId,
  seatPeriods,
  source = "admin-team-lineup",
  now = new Date().toISOString(),
  reviewedRounds = [],
  evidenceRounds = [],
  historicalCorrectionConfirmed = false
}) {
  const safeSeasonId = optionalPositiveInteger(seasonId, "Season");
  const teams = db.prepare(
    "SELECT t.*, st.display_name_override, st.display_order, st.active FROM season_teams st JOIN teams t ON t.id = st.team_id WHERE st.season_id = ?"
  ).all(safeSeasonId);
  const drivers = db.prepare(
    "SELECT d.*, sd.display_name_override, sd.active AS season_active FROM season_drivers sd JOIN drivers d ON d.id = sd.driver_id WHERE sd.season_id = ?"
  ).all(safeSeasonId);
  const assignments = db.prepare(
    "SELECT * FROM driver_team_assignments WHERE season_id = ? ORDER BY from_round, id"
  ).all(safeSeasonId);
  const plan = buildTeamLineupHistoryPlan({
    teams,
    drivers,
    assignments,
    teamId,
    seatPeriods,
    seasonRoundCount: db.prepare("SELECT COUNT(*) AS count FROM races WHERE season_id = ?").get(safeSeasonId)?.count,
    source
  });
  if (plan.affectedFromRound != null) {
    assertHistoricalCorrection({
      roundNumber: plan.affectedFromRound,
      reviewedRounds,
      evidenceRounds,
      historicalCorrectionConfirmed
    });
  }
  const tx = db.transaction(() => {
    const deletes = plan.operations.filter((operation) => operation.type === "delete");
    const updates = plan.operations.filter((operation) => operation.type === "update");
    const inserts = plan.operations.filter((operation) => operation.type === "insert");
    for (const operation of deletes) {
      db.prepare("DELETE FROM driver_team_assignments WHERE id = ? AND season_id = ?")
        .run(operation.assignmentId, safeSeasonId);
    }
    // Stage changed rows away from their old unique (driver, from_round) keys so
    // swaps can be applied without a transient uniqueness conflict.
    updates.forEach((operation, index) => {
      db.prepare("UPDATE driver_team_assignments SET from_round = ?, to_round = NULL, updated_at = ? WHERE id = ? AND season_id = ?")
        .run(1000000 + index, now, operation.assignmentId, safeSeasonId);
    });
    for (const operation of updates) {
      db.prepare(
        "UPDATE driver_team_assignments SET driver_id = ?, team_id = ?, seat_number = ?, from_round = ?, to_round = ?, source = ?, updated_at = ? WHERE id = ? AND season_id = ?"
      ).run(operation.driverId, operation.teamId, operation.seatNumber, operation.fromRound, operation.toRound, String(operation.source), now, operation.assignmentId, safeSeasonId);
    }
    for (const operation of inserts) {
      db.prepare(
        "INSERT INTO driver_team_assignments (season_id, driver_id, team_id, seat_number, from_round, to_round, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(safeSeasonId, operation.driverId, operation.teamId, operation.seatNumber, operation.fromRound, operation.toRound, String(operation.source), now, now);
    }
    return plan;
  });
  return tx();
}

function normalizeDesiredSeats({ teams, desiredSeats }) {
  const teamIds = new Set(teams.map((team) => Number(team.id)));
  const bySeat = new Map();
  for (const desired of desiredSeats || []) {
    const teamId = numberOrNull(desired.teamId ?? desired.team_id);
    const seatNumber = Number(desired.seatNumber ?? desired.seat_number);
    const driverId = numberOrNull(desired.driverId ?? desired.driver_id);
    if (teamId == null || !teamIds.has(teamId)) throw new Error(`Unknown season team ${desired.teamId}.`);
    if (![1, 2].includes(seatNumber)) throw new Error("Seat number must be 1 or 2.");
    const key = `${teamId}:${seatNumber}`;
    if (bySeat.has(key)) throw new Error(`Team ${teamId} seat ${seatNumber} is specified more than once.`);
    bySeat.set(key, { teamId, seatNumber, driverId });
  }
  return teams.flatMap((team) => [1, 2].map((seatNumber) => bySeat.get(`${Number(team.id)}:${seatNumber}`) || {
    teamId: Number(team.id), seatNumber, driverId: null
  }));
}

function buildLineupPlan({ teams = [], drivers = [], assignments = [], roundNumber, desiredSeats = [] }) {
  const round = Number(roundNumber);
  if (!Number.isInteger(round) || round < 1) throw new Error("Round number must be a positive integer.");
  const desired = normalizeDesiredSeats({ teams, desiredSeats });
  const driverIds = new Set(drivers.map((driver) => Number(driver.id)));
  const occupied = new Set();
  for (const seat of desired) {
    if (seat.driverId == null) continue;
    if (!driverIds.has(seat.driverId)) throw new Error(`Unknown season driver ${seat.driverId}.`);
    if (occupied.has(seat.driverId)) throw new Error(`Driver ${seat.driverId} is assigned to more than one active seat.`);
    occupied.add(seat.driverId);
  }

  const projection = buildLineupProjection({ teams, drivers, assignments, roundNumber: round });
  const currentBySeat = new Map(projection.flatMap((team) => team.seats.map((seat) => [
    `${team.teamId}:${seat.seatNumber}`, { ...seat, teamId: team.teamId }
  ])));
  const operations = [];
  const changedKeys = new Set();
  for (const desiredSeat of desired) {
    const key = `${desiredSeat.teamId}:${desiredSeat.seatNumber}`;
    const current = currentBySeat.get(key);
    if (Number(current?.driverId || 0) === Number(desiredSeat.driverId || 0)) continue;
    changedKeys.add(key);
    const affected = assignments
      .filter((assignment) => Number(assignment.team_id) === desiredSeat.teamId
        && Number(assignment.seat_number || 1) === desiredSeat.seatNumber
        && (Number(assignment.from_round) >= round
          || (Number(assignment.from_round) < round
            && (assignment.to_round == null || Number(assignment.to_round) >= round))))
      .sort((left, right) => Number(left.from_round) - Number(right.from_round));
    for (const assignment of affected) {
      if (Number(assignment.from_round) < round) {
        operations.push({ type: "close", assignmentId: Number(assignment.id), toRound: round - 1 });
      } else {
        operations.push({ type: "delete", assignmentId: Number(assignment.id) });
      }
    }
  }
  for (const desiredSeat of desired) {
    const key = `${desiredSeat.teamId}:${desiredSeat.seatNumber}`;
    if (!changedKeys.has(key) || desiredSeat.driverId == null) continue;
    operations.push({ type: "insert", teamId: desiredSeat.teamId, seatNumber: desiredSeat.seatNumber, driverId: desiredSeat.driverId, fromRound: round });
  }
  return { roundNumber: round, desiredSeats: desired, projection, operations };
}

function historicalCorrectionRequired({ roundNumber, reviewedRounds = [], evidenceRounds = [] }) {
  const round = Number(roundNumber);
  return [...reviewedRounds, ...evidenceRounds].some((value) => Number(value) >= round);
}

function assertHistoricalCorrection({ roundNumber, reviewedRounds = [], evidenceRounds = [], historicalCorrectionConfirmed = false }) {
  if (historicalCorrectionRequired({ roundNumber, reviewedRounds, evidenceRounds }) && !historicalCorrectionConfirmed) {
    const error = new Error("Historical correction confirmation is required for this round.");
    error.code = "HISTORICAL_CORRECTION_CONFIRMATION_REQUIRED";
    throw error;
  }
}

function applySeasonLineup(db, {
  seasonId,
  roundNumber,
  desiredSeats,
  source = "admin-lineup",
  now = new Date().toISOString(),
  reviewedRounds = [],
  evidenceRounds = [],
  historicalCorrectionConfirmed = false
}) {
  assertHistoricalCorrection({ roundNumber, reviewedRounds, evidenceRounds, historicalCorrectionConfirmed });
  const safeSeasonId = Number(seasonId);
  const safeRound = Number(roundNumber);
  const teams = db.prepare(
    "SELECT t.*, st.display_name_override, st.display_order, st.active FROM season_teams st JOIN teams t ON t.id = st.team_id WHERE st.season_id = ? AND st.active = 1"
  ).all(safeSeasonId);
  const drivers = db.prepare(
    "SELECT d.*, sd.display_name_override, sd.active AS season_active FROM season_drivers sd JOIN drivers d ON d.id = sd.driver_id WHERE sd.season_id = ? AND sd.active = 1"
  ).all(safeSeasonId);
  const assignments = db.prepare(
    "SELECT * FROM driver_team_assignments WHERE season_id = ? ORDER BY from_round, id"
  ).all(safeSeasonId);
  const plan = buildLineupPlan({ teams, drivers, assignments, roundNumber: safeRound, desiredSeats });
  const tx = db.transaction(() => {
    for (const operation of plan.operations) {
      if (operation.type === "close") {
        db.prepare("UPDATE driver_team_assignments SET to_round = ?, updated_at = ? WHERE id = ? AND season_id = ?")
          .run(operation.toRound, now, operation.assignmentId, safeSeasonId);
      } else if (operation.type === "delete") {
        db.prepare("DELETE FROM driver_team_assignments WHERE id = ? AND season_id = ?")
          .run(operation.assignmentId, safeSeasonId);
      } else if (operation.type === "insert") {
        db.prepare(
          "INSERT INTO driver_team_assignments (season_id, driver_id, team_id, seat_number, from_round, to_round, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)"
        ).run(safeSeasonId, operation.driverId, operation.teamId, operation.seatNumber, operation.fromRound, String(source), now, now);
      }
    }
    return plan;
  });
  return tx();
}

module.exports = {
  applySeasonLineup,
  applyTeamLineupHistory,
  assertAssignmentIntervals,
  assertHistoricalCorrection,
  buildLineupPlan,
  buildLineupProjection,
  buildTeamLineupHistory,
  buildTeamLineupHistoryPlan,
  historicalCorrectionRequired
};
