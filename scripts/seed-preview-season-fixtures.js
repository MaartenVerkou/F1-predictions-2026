"use strict";

const path = require("path");
const fs = require("fs");
const { createAppDatabase } = require("../src/app-database");
const {
  createOrGetSeason,
  ensureSeasonInputsSchema,
  upsertDriver,
  upsertDriverTeamAssignment,
  upsertRace,
  upsertSeasonDriver,
  upsertSeasonTeam
} = require("../src/season-inputs");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const RACES_PATH = path.join(DATA_DIR, "races.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function copySeason(db, sourceSeason, targetSeason, status, { replacement = false } = {}) {
  const now = new Date().toISOString();
  const source = db.prepare("SELECT * FROM seasons WHERE year = ? LIMIT 1").get(Number(sourceSeason));
  if (!source) throw new Error(`Source season ${sourceSeason} is not seeded.`);
  const target = createOrGetSeason(db, {
    year: targetSeason,
    label: `${targetSeason} ${status}`,
    status,
    now
  });
  const calendar = readJson(RACES_PATH).calendar?.[String(targetSeason)] || {};

  db.prepare("DELETE FROM driver_team_assignments WHERE season_id = ?").run(target.id);
  db.prepare("DELETE FROM races WHERE season_id = ?").run(target.id);
  db.prepare("DELETE FROM season_drivers WHERE season_id = ?").run(target.id);
  db.prepare("DELETE FROM season_teams WHERE season_id = ?").run(target.id);

  db.prepare("SELECT * FROM season_teams WHERE season_id = ? ORDER BY display_order, team_id").all(source.id).forEach((row) => {
    upsertSeasonTeam(db, {
      seasonId: target.id,
      teamId: row.team_id,
      displayNameOverride: row.display_name_override,
      displayOrder: row.display_order,
      orderBasis: row.order_basis,
      now
    });
  });
  db.prepare("SELECT * FROM season_drivers WHERE season_id = ? ORDER BY driver_id").all(source.id).forEach((row) => {
    upsertSeasonDriver(db, {
      seasonId: target.id,
      driverId: row.driver_id,
      driverNumber: row.driver_number,
      displayNameOverride: row.display_name_override,
      now
    });
  });
  db.prepare("SELECT * FROM races WHERE season_id = ? ORDER BY round_number").all(source.id).forEach((row) => {
    upsertRace(db, {
      seasonId: target.id,
      roundNumber: row.round_number,
      slug: row.slug,
      displayName: row.display_name,
      scheduledDate: calendar[row.display_name]?.start || null,
      scheduledTimezone: calendar[row.display_name]?.timezone || null,
      calendarState: row.calendar_state,
      now
    });
  });

  const reserveDriver = replacement
    ? upsertDriver(db, { slug: "preview-reserve-driver", displayName: "Preview Reserve Driver", now })
    : null;
  if (reserveDriver) {
    upsertSeasonDriver(db, {
      seasonId: target.id,
      driverId: reserveDriver,
      driverNumber: "98",
      now
    });
  }

  const replacementSourceDriverId = replacement
    ? db.prepare("SELECT id FROM drivers WHERE display_name = ? LIMIT 1").get("Carlos Sainz Jr.")?.id
    : null;
  const assignments = db.prepare("SELECT * FROM driver_team_assignments WHERE season_id = ? ORDER BY from_round, id").all(source.id);
  assignments.forEach((row) => {
    const isReplacementSeat = replacement
      && Number(row.driver_id) === Number(replacementSourceDriverId)
      && Number(row.seat_number || 1) === 1
      && Number(row.from_round) === 1;
    if (isReplacementSeat) {
      upsertDriverTeamAssignment(db, {
        seasonId: target.id,
        driverId: row.driver_id,
        teamId: row.team_id,
        seatNumber: row.seat_number,
        fromRound: 1,
        toRound: 2,
        source: "preview-fixture",
        now
      });
      upsertDriverTeamAssignment(db, {
        seasonId: target.id,
        driverId: reserveDriver,
        teamId: row.team_id,
        seatNumber: row.seat_number,
        fromRound: 3,
        source: "preview-fixture",
        now
      });
      return;
    }
    upsertDriverTeamAssignment(db, {
      seasonId: target.id,
      driverId: row.driver_id,
      teamId: row.team_id,
      seatNumber: row.seat_number,
      fromRound: row.from_round,
      toRound: row.to_round,
      source: "preview-fixture",
      now
    });
  });
  return { year: targetSeason, status, seasonId: target.id, replacementDriverId: reserveDriver };
}

function seedPreviewSeasonFixtures(db) {
  ensureSeasonInputsSchema(db);
  const transaction = db.transaction(() => [
    copySeason(db, 2026, 2025, "archived"),
    copySeason(db, 2026, 2027, "planned", { replacement: true })
  ]);
  return transaction();
}

function main() {
  const db = createAppDatabase({
    databaseUrl: String(process.env.DATABASE_URL || ""),
    sqlitePath: process.env.DB_PATH || path.join(DATA_DIR, "app.db")
  });
  try {
    console.log(JSON.stringify(seedPreviewSeasonFixtures(db), null, 2));
  } finally {
    db.close?.();
  }
}

if (require.main === module) main();

module.exports = { copySeason, seedPreviewSeasonFixtures };
