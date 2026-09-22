"use strict";

const fs = require("fs");
const path = require("path");
const { createAppDatabase } = require("../src/app-database");
const {
  ENTITY_TYPES,
  addEntityAlias,
  addProviderReference,
  createOrGetSeason,
  ensureSeasonInputsSchema,
  slugify,
  upsertDriver,
  upsertDriverTeamAssignment,
  upsertRace,
  upsertSeasonDriver,
  upsertSeasonTeam,
  upsertTeam
} = require("../src/season-inputs");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const ROSTER_PATH = process.env.ROSTER_PATH || path.join(DATA_DIR, "roster.json");
const RACES_PATH = process.env.RACES_PATH || path.join(DATA_DIR, "races.json");
const SEASON = Number(process.env.F1_SEASON || 2026);

const DRIVER_TEAM_ASSIGNMENTS = {
  "Alexander Albon": "Williams",
  "Arvid Lindblad": "Racing Bulls",
  "Carlos Sainz Jr.": "Williams",
  "Charles Leclerc": "Ferrari",
  "Esteban Ocon": "Haas F1 Team",
  "Fernando Alonso": "Aston Martin",
  "Franco Colapinto": "Alpine",
  "Gabriel Bortoleto": "Audi",
  "George Russell": "Mercedes",
  "Isack Hadjar": "Red Bull Racing",
  "Kimi Antonelli": "Mercedes",
  "Lance Stroll": "Aston Martin",
  "Lando Norris": "McLaren",
  "Lewis Hamilton": "Ferrari",
  "Liam Lawson": "Racing Bulls",
  "Max Verstappen": "Red Bull Racing",
  "Nico Hulkenberg": "Audi",
  "Oliver Bearman": "Haas F1 Team",
  "Oscar Piastri": "McLaren",
  "Pierre Gasly": "Alpine",
  "Sergio Perez": "Cadillac",
  "Valtteri Bottas": "Cadillac"
};

// Stable presentation order for the season. IDs remain opaque database keys;
// this list can be replaced for a future season without renumbering entities.
const TEAM_DISPLAY_ORDER = [
  "Mercedes", "Ferrari", "McLaren", "Red Bull Racing", "Racing Bulls",
  "Alpine", "Haas F1 Team", "Audi", "Williams", "Aston Martin", "Cadillac"
];

const TEAM_DRIVER_ORDER = {
  Mercedes: ["George Russell", "Kimi Antonelli"],
  Ferrari: ["Charles Leclerc", "Lewis Hamilton"],
  McLaren: ["Lando Norris", "Oscar Piastri"],
  "Red Bull Racing": ["Max Verstappen", "Isack Hadjar"],
  "Racing Bulls": ["Liam Lawson", "Arvid Lindblad"],
  Alpine: ["Pierre Gasly", "Franco Colapinto"],
  "Haas F1 Team": ["Esteban Ocon", "Oliver Bearman"],
  Audi: ["Nico Hulkenberg", "Gabriel Bortoleto"],
  Williams: ["Carlos Sainz Jr.", "Alexander Albon"],
  "Aston Martin": ["Fernando Alonso", "Lance Stroll"],
  Cadillac: ["Sergio Perez", "Valtteri Bottas"]
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function providerKeyForDriver(name) {
  return slugify(name).replace(/-/g, "_").replace(/_jr$/, "");
}

function seedSeasonInputs(db, { season = SEASON, now = new Date().toISOString() } = {}) {
  ensureSeasonInputsSchema(db);
  const roster = readJson(ROSTER_PATH);
  const raceData = readJson(RACES_PATH);
  const raceNames = raceData.races || [];
  const calendar = raceData.calendar?.[String(season)] || {};
  const transaction = db.transaction(() => {
    const seasonRow = createOrGetSeason(db, { year: season, label: String(season), now });
    const teamIds = new Map();
    for (const teamName of roster.teams || []) {
      const teamProfile = roster.team_profiles?.[teamName] || {};
      const id = upsertTeam(db, {
        displayName: teamName,
        slug: slugify(teamName),
        shortName: teamName,
        teamCode: teamProfile.team_code,
        baseCountryCode: teamProfile.base_country_code,
        f1EntryYear: teamProfile.f1_entry_year,
        now
      });
      teamIds.set(teamName, id);
      addEntityAlias(db, { entityType: ENTITY_TYPES.TEAM, entityId: id, alias: teamName, source: "seed", now });
      addProviderReference(db, { entityType: ENTITY_TYPES.TEAM, entityId: id, provider: "jolpica", providerKey: slugify(teamName), providerLabel: teamName, now });
      const displayOrder = TEAM_DISPLAY_ORDER.indexOf(teamName) + 1 || TEAM_DISPLAY_ORDER.length + 1;
      upsertSeasonTeam(db, { seasonId: seasonRow.id, teamId: id, displayOrder, orderBasis: "official", now });
    }

    const driverIds = new Map();
    for (const driverName of roster.drivers || []) {
      const profile = roster.driver_profiles?.[driverName] || {};
      const id = upsertDriver(db, {
        displayName: driverName,
        slug: slugify(driverName),
        driverCode: profile.driver_code,
        nationalityCode: profile.nationality_code,
        dateOfBirth: profile.date_of_birth,
        now
      });
      driverIds.set(driverName, id);
      addEntityAlias(db, { entityType: ENTITY_TYPES.DRIVER, entityId: id, alias: driverName, source: "seed", now });
      addProviderReference(db, { entityType: ENTITY_TYPES.DRIVER, entityId: id, provider: "jolpica", providerKey: providerKeyForDriver(driverName), providerLabel: driverName, now });
      const driverNumber = roster.driver_numbers?.[driverName];
      if (driverNumber == null) throw new Error(`Missing canonical driver number for ${driverName}.`);
      upsertSeasonDriver(db, { seasonId: seasonRow.id, driverId: id, driverNumber, now });
      const teamName = DRIVER_TEAM_ASSIGNMENTS[driverName];
      if (!teamName || !teamIds.has(teamName)) throw new Error(`Missing canonical team assignment for ${driverName}.`);
      const seatNumber = (TEAM_DRIVER_ORDER[teamName] || []).indexOf(driverName) + 1 || 1;
      const existing = db.prepare("SELECT id, team_id, seat_number FROM driver_team_assignments WHERE season_id = ? AND driver_id = ? AND from_round = 1 LIMIT 1").get(seasonRow.id, id);
      if (!existing) {
        upsertDriverTeamAssignment(db, { seasonId: seasonRow.id, driverId: id, teamId: teamIds.get(teamName), seatNumber, fromRound: 1, source: "seed", now });
      } else if (Number(existing.team_id) !== Number(teamIds.get(teamName)) || Number(existing.seat_number || 1) !== seatNumber) {
        db.prepare("UPDATE driver_team_assignments SET team_id = ?, seat_number = ?, source = ?, updated_at = ? WHERE id = ?").run(teamIds.get(teamName), seatNumber, "seed", now, Number(existing.id));
      }
    }

    const raceIds = [];
    raceNames.forEach((raceName, index) => {
      const roundNumber = index + 1;
      const raceId = upsertRace(db, {
        seasonId: seasonRow.id,
        roundNumber,
        slug: slugify(raceName),
        displayName: raceName,
        scheduledDate: calendar[raceName]?.start || null,
        scheduledTimezone: calendar[raceName]?.timezone || null,
        raceCode: calendar[raceName]?.code,
        countryCode: calendar[raceName]?.country_code,
        circuitName: calendar[raceName]?.circuit,
        calendarState: "scheduled",
        now
      });
      addEntityAlias(db, { entityType: ENTITY_TYPES.RACE, entityId: raceId, seasonId: seasonRow.id, alias: raceName, source: "seed", now });
      addProviderReference(db, { entityType: ENTITY_TYPES.RACE, entityId: raceId, provider: "jolpica", providerKey: `${season}-round-${roundNumber}`, providerLabel: raceName, now });
      raceIds.push(raceId);
    });
    return { seasonId: seasonRow.id, driverCount: driverIds.size, teamCount: teamIds.size, raceCount: raceIds.length };
  });
  return transaction();
}

function main() {
  const db = createAppDatabase({ databaseUrl: String(process.env.DATABASE_URL || ""), sqlitePath: process.env.DB_PATH || path.join(DATA_DIR, "app.db") });
  try {
    console.log(JSON.stringify(seedSeasonInputs(db), null, 2));
  } finally {
    db.close?.();
  }
}

if (require.main === module) main();

module.exports = { DRIVER_TEAM_ASSIGNMENTS, TEAM_DISPLAY_ORDER, TEAM_DRIVER_ORDER, seedSeasonInputs };
