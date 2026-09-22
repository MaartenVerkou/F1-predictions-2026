"use strict";

const { assertAssignmentIntervals } = require("./season-lineup");

const ENTITY_TYPES = Object.freeze({
  DRIVER: "driver",
  TEAM: "team",
  RACE: "race"
});

function normalizeEntityKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "entity";
}

function splitDisplayName(value) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  return {
    givenName: parts.shift() || "",
    familyName: parts.join(" ")
  };
}

function normalizeDriverNumber(value) {
  if (value == null || String(value).trim() === "") return null;
  const safeValue = String(value).trim();
  if (!/^\d+$/.test(safeValue)) throw new Error("Driver number must be a whole number between 1 and 99.");
  const number = Number(safeValue);
  if (!Number.isInteger(number) || number < 1 || number > 99) {
    throw new Error("Driver number must be a whole number between 1 and 99.");
  }
  return String(number);
}

function normalizeDriverCode(value) {
  if (value == null || String(value).trim() === "") return null;
  const code = String(value).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error("Driver code must contain exactly three letters.");
  return code;
}

function normalizeNationalityCode(value) {
  if (value == null || String(value).trim() === "") return null;
  const code = String(value).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error("Nationality code must contain exactly two letters.");
  return code;
}

function parseIsoDate(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

function normalizeDateOfBirth(value) {
  if (value == null || String(value).trim() === "") return null;
  const date = parseIsoDate(value);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) {
    throw new Error("Date of birth must be a valid date in YYYY-MM-DD format.");
  }
  return String(value).trim();
}

function normalizeEntityCode(value, label) {
  if (value == null || String(value).trim() === "") return null;
  const code = String(value).trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(code)) throw new Error(`${label} must contain 2-8 letters or numbers.`);
  return code;
}

function normalizeCountryCode(value, label = "Country code") {
  if (value == null || String(value).trim() === "") return null;
  const code = String(value).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error(`${label} must contain exactly two letters.`);
  return code;
}

function normalizeF1EntryYear(value) {
  if (value == null || String(value).trim() === "") return null;
  const year = Number(String(value).trim());
  if (!Number.isInteger(year) || year < 1950 || year > 2200) {
    throw new Error("F1 entry season must be a four-digit year from 1950 onward.");
  }
  return year;
}

function calculateDriverAge(dateOfBirth, referenceDate) {
  const birth = parseIsoDate(dateOfBirth);
  const reference = parseIsoDate(referenceDate);
  if (!birth || !reference || birth > reference) return null;
  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  const birthdayHasPassed = reference.getUTCMonth() > birth.getUTCMonth()
    || (reference.getUTCMonth() === birth.getUTCMonth() && reference.getUTCDate() >= birth.getUTCDate());
  if (!birthdayHasPassed) age -= 1;
  return age >= 0 ? age : null;
}

function seasonAgeReferenceDate(year, races = []) {
  const firstScheduledRace = races.find((race) => parseIsoDate(race.scheduled_date));
  return firstScheduledRace?.scheduled_date
    ? String(firstScheduledRace.scheduled_date).slice(0, 10)
    : `${Number(year)}-01-01`;
}

const RACE_COMPLETION_WINDOW_MS = 12 * 60 * 60 * 1000;

function deriveRaceCalendarStatus(race, now = new Date()) {
  const calendarState = String(race?.calendar_state || "scheduled").trim().toLowerCase();
  if (["completed", "cancelled", "partial"].includes(calendarState)) return calendarState;

  const scheduledTime = Date.parse(String(race?.scheduled_date || ""));
  const currentTime = now instanceof Date ? now.getTime() : Date.parse(String(now || ""));
  if (!Number.isFinite(scheduledTime) || !Number.isFinite(currentTime)) return "unscheduled";
  if (scheduledTime > currentTime) return "upcoming";
  return currentTime - scheduledTime >= RACE_COMPLETION_WINDOW_MS ? "completed" : "started";
}

function driverNumberForSort(value) {
  const safeValue = String(value ?? "").trim();
  if (!/^\d+$/.test(safeValue)) return null;
  const number = Number(safeValue);
  return Number.isInteger(number) ? number : null;
}

function sortSeasonDrivers(drivers) {
  return drivers.slice().sort((left, right) => {
    const leftNumber = driverNumberForSort(left.driver_number);
    const rightNumber = driverNumberForSort(right.driver_number);
    if (leftNumber == null && rightNumber != null) return 1;
    if (leftNumber != null && rightNumber == null) return -1;
    if (leftNumber != null && rightNumber != null && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
    return Number(left.id) - Number(right.id);
  });
}

function referenceFor(entityType, entityId) {
  if (!entityType || entityId == null) return null;
  return `${String(entityType)}:${Number(entityId)}`;
}

function parseReference(value) {
  const match = String(value || "").match(/^(driver|team|race):(\d+)$/);
  return match ? { entityType: match[1], entityId: Number(match[2]) } : null;
}

function idDefinition(db) {
  return db.dialect === "postgres"
    ? "INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY"
    : "INTEGER PRIMARY KEY AUTOINCREMENT";
}

function ensureSeasonInputsSchema(db) {
  const identityType = idDefinition(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS seasons (
      id ${identityType}, year INTEGER NOT NULL UNIQUE, label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS drivers (
      id ${identityType}, slug TEXT NOT NULL UNIQUE, given_name TEXT NOT NULL,
      family_name TEXT NOT NULL, display_name TEXT NOT NULL, driver_code TEXT,
      nationality_code TEXT, date_of_birth TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS teams (
      id ${identityType}, slug TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
      short_name TEXT, team_code TEXT, base_country_code TEXT, f1_entry_year INTEGER,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS races (
      id ${identityType}, season_id INTEGER NOT NULL, round_number INTEGER NOT NULL,
      slug TEXT NOT NULL, display_name TEXT NOT NULL, scheduled_date TEXT,
      scheduled_timezone TEXT, race_code TEXT, country_code TEXT, circuit_name TEXT,
      calendar_state TEXT NOT NULL DEFAULT 'scheduled', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(season_id, round_number), UNIQUE(season_id, slug)
    );
    CREATE TABLE IF NOT EXISTS season_drivers (
      season_id INTEGER NOT NULL, driver_id INTEGER NOT NULL, driver_number TEXT,
      display_name_override TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(season_id, driver_id)
    );
    CREATE TABLE IF NOT EXISTS season_teams (
      season_id INTEGER NOT NULL, team_id INTEGER NOT NULL, display_name_override TEXT,
      display_order INTEGER NOT NULL DEFAULT 0, order_basis TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(season_id, team_id)
    );
    CREATE TABLE IF NOT EXISTS driver_team_assignments (
      id ${identityType}, season_id INTEGER NOT NULL, driver_id INTEGER NOT NULL, team_id INTEGER NOT NULL,
      from_round INTEGER NOT NULL, to_round INTEGER, seat_number INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(season_id, driver_id, from_round)
    );
    CREATE INDEX IF NOT EXISTS idx_driver_team_assignments_lookup
      ON driver_team_assignments(season_id, driver_id, from_round, to_round);
    CREATE INDEX IF NOT EXISTS idx_driver_team_assignments_seat_lookup
      ON driver_team_assignments(season_id, team_id, seat_number, from_round, to_round);
    CREATE INDEX IF NOT EXISTS idx_season_drivers_driver_lookup
      ON season_drivers(driver_id, season_id);
    CREATE INDEX IF NOT EXISTS idx_season_teams_team_lookup
      ON season_teams(team_id, season_id);
    CREATE TABLE IF NOT EXISTS entity_aliases (
      id ${identityType}, entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL, season_id INTEGER,
      alias TEXT NOT NULL, normalized_alias TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL, UNIQUE(entity_type, season_id, normalized_alias)
    );
    CREATE INDEX IF NOT EXISTS idx_entity_aliases_lookup
      ON entity_aliases(entity_type, season_id, normalized_alias);
    CREATE TABLE IF NOT EXISTS entity_provider_refs (
      id ${identityType}, entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL,
      provider TEXT NOT NULL, provider_key TEXT NOT NULL, provider_label TEXT, created_at TEXT NOT NULL,
      UNIQUE(provider, provider_key), UNIQUE(entity_type, entity_id, provider)
    );
  `);
  const addColumnIfMissing = (table, column, definition) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some((entry) => entry.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };
  const hasColumn = (table, column) => db.prepare(`PRAGMA table_info(${table})`).all()
    .some((entry) => entry.name === column);
  const dropColumnIfPresent = (table, column) => {
    if (hasColumn(table, column)) db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  };
  addColumnIfMissing("season_teams", "display_order", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing("season_teams", "order_basis", "TEXT NOT NULL DEFAULT 'manual'");
  addColumnIfMissing("driver_team_assignments", "seat_number", "INTEGER NOT NULL DEFAULT 1");
  addColumnIfMissing("races", "scheduled_timezone", "TEXT");
  addColumnIfMissing("teams", "team_code", "TEXT");
  addColumnIfMissing("teams", "base_country_code", "TEXT");
  addColumnIfMissing("teams", "f1_entry_year", "INTEGER");
  addColumnIfMissing("races", "race_code", "TEXT");
  addColumnIfMissing("races", "country_code", "TEXT");
  addColumnIfMissing("races", "circuit_name", "TEXT");
  addColumnIfMissing("drivers", "driver_code", "TEXT");
  addColumnIfMissing("drivers", "nationality_code", "TEXT");
  addColumnIfMissing("drivers", "date_of_birth", "TEXT");

  if (hasColumn("season_drivers", "active")) {
    db.exec(
      "DELETE FROM season_drivers WHERE active = 0 AND NOT EXISTS " +
      "(SELECT 1 FROM driver_team_assignments a WHERE a.season_id = season_drivers.season_id AND a.driver_id = season_drivers.driver_id)"
    );
  }
  if (hasColumn("season_teams", "active")) {
    db.exec(
      "DELETE FROM season_teams WHERE active = 0 AND NOT EXISTS " +
      "(SELECT 1 FROM driver_team_assignments a WHERE a.season_id = season_teams.season_id AND a.team_id = season_teams.team_id)"
    );
  }
  [
    ["drivers", "active"],
    ["teams", "active"],
    ["season_drivers", "active"],
    ["season_teams", "active"]
  ].forEach(([table, column]) => dropColumnIfPresent(table, column));
}

function createOrGetSeason(db, { year, label = String(year), status = "active", now = new Date().toISOString() }) {
  const existing = db.prepare("SELECT id, year, label, status FROM seasons WHERE year = ? LIMIT 1").get(Number(year));
  if (existing) return { ...existing, id: Number(existing.id), year: Number(existing.year) };
  const result = db.prepare(
    "INSERT INTO seasons (year, label, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
  ).run(Number(year), String(label), String(status), now, now);
  return { id: Number(result.lastInsertRowid), year: Number(year), label: String(label), status: String(status) };
}

function upsertDriver(db, {
  slug,
  displayName,
  givenName,
  familyName,
  driverCode,
  nationalityCode,
  dateOfBirth,
  now = new Date().toISOString()
}) {
  const safeName = String(displayName || `${givenName || ""} ${familyName || ""}`).trim();
  const parts = splitDisplayName(safeName);
  const safeSlug = slugify(slug || safeName);
  const existing = db.prepare("SELECT id, driver_code, nationality_code, date_of_birth FROM drivers WHERE slug = ? LIMIT 1").get(safeSlug);
  const nextDriverCode = driverCode === undefined ? existing?.driver_code || null : normalizeDriverCode(driverCode);
  const nextNationalityCode = nationalityCode === undefined ? existing?.nationality_code || null : normalizeNationalityCode(nationalityCode);
  const nextDateOfBirth = dateOfBirth === undefined ? existing?.date_of_birth || null : normalizeDateOfBirth(dateOfBirth);
  if (existing) {
    db.prepare("UPDATE drivers SET given_name = ?, family_name = ?, display_name = ?, driver_code = ?, nationality_code = ?, date_of_birth = ?, updated_at = ? WHERE id = ?")
      .run(givenName || parts.givenName, familyName || parts.familyName, safeName, nextDriverCode, nextNationalityCode, nextDateOfBirth, now, Number(existing.id));
    return Number(existing.id);
  }
  const result = db.prepare(
    "INSERT INTO drivers (slug, given_name, family_name, display_name, driver_code, nationality_code, date_of_birth, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(safeSlug, givenName || parts.givenName, familyName || parts.familyName, safeName, nextDriverCode, nextNationalityCode, nextDateOfBirth, now, now);
  return Number(result.lastInsertRowid);
}

function upsertTeam(db, { slug, displayName, shortName = null, teamCode, baseCountryCode, f1EntryYear, now = new Date().toISOString() }) {
  const safeName = String(displayName || "").trim();
  const safeSlug = slugify(slug || safeName);
  const existing = db.prepare("SELECT id, team_code, base_country_code, f1_entry_year FROM teams WHERE slug = ? LIMIT 1").get(safeSlug);
  const nextTeamCode = teamCode === undefined ? existing?.team_code || null : normalizeEntityCode(teamCode, "Team code");
  const nextBaseCountryCode = baseCountryCode === undefined ? existing?.base_country_code || null : normalizeCountryCode(baseCountryCode, "Base country code");
  const nextF1EntryYear = f1EntryYear === undefined ? existing?.f1_entry_year || null : normalizeF1EntryYear(f1EntryYear);
  if (existing) {
    db.prepare("UPDATE teams SET display_name = ?, short_name = ?, team_code = ?, base_country_code = ?, f1_entry_year = ?, updated_at = ? WHERE id = ?")
      .run(safeName, shortName, nextTeamCode, nextBaseCountryCode, nextF1EntryYear, now, Number(existing.id));
    return Number(existing.id);
  }
  const result = db.prepare(
    "INSERT INTO teams (slug, display_name, short_name, team_code, base_country_code, f1_entry_year, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(safeSlug, safeName, shortName, nextTeamCode, nextBaseCountryCode, nextF1EntryYear, now, now);
  return Number(result.lastInsertRowid);
}

function upsertRace(db, { seasonId, roundNumber, slug, displayName, scheduledDate = null, scheduledTimezone = null, raceCode, countryCode, circuitName, calendarState = "scheduled", now = new Date().toISOString() }) {
  const existing = db.prepare("SELECT id, race_code, country_code, circuit_name FROM races WHERE season_id = ? AND round_number = ? LIMIT 1").get(Number(seasonId), Number(roundNumber));
  const nextRaceCode = raceCode === undefined ? existing?.race_code || null : normalizeEntityCode(raceCode, "Race code");
  const nextCountryCode = countryCode === undefined ? existing?.country_code || null : normalizeCountryCode(countryCode);
  const nextCircuitName = circuitName === undefined ? existing?.circuit_name || null : (String(circuitName || "").trim() || null);
  if (existing) {
    db.prepare("UPDATE races SET slug = ?, display_name = ?, scheduled_date = ?, scheduled_timezone = ?, race_code = ?, country_code = ?, circuit_name = ?, calendar_state = ?, updated_at = ? WHERE id = ?")
      .run(String(slug), String(displayName), scheduledDate, scheduledTimezone, nextRaceCode, nextCountryCode, nextCircuitName, String(calendarState), now, Number(existing.id));
    return Number(existing.id);
  }
  const result = db.prepare(
    "INSERT INTO races (season_id, round_number, slug, display_name, scheduled_date, scheduled_timezone, race_code, country_code, circuit_name, calendar_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(Number(seasonId), Number(roundNumber), String(slug), String(displayName), scheduledDate, scheduledTimezone, nextRaceCode, nextCountryCode, nextCircuitName, String(calendarState), now, now);
  return Number(result.lastInsertRowid);
}

function upsertSeasonDriver(db, { seasonId, driverId, driverNumber = null, displayNameOverride = null, now = new Date().toISOString() }) {
  const normalizedDriverNumber = normalizeDriverNumber(driverNumber);
  db.prepare(
    "INSERT INTO season_drivers (season_id, driver_id, driver_number, display_name_override, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(season_id, driver_id) DO UPDATE SET driver_number = excluded.driver_number, display_name_override = excluded.display_name_override, updated_at = excluded.updated_at"
  ).run(Number(seasonId), Number(driverId), normalizedDriverNumber, displayNameOverride, now, now);
}

function upsertSeasonTeam(db, { seasonId, teamId, displayNameOverride = null, displayOrder = 0, orderBasis = "manual", now = new Date().toISOString() }) {
  db.prepare(
    "INSERT INTO season_teams (season_id, team_id, display_name_override, display_order, order_basis, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(season_id, team_id) DO UPDATE SET display_name_override = excluded.display_name_override, display_order = excluded.display_order, order_basis = excluded.order_basis, updated_at = excluded.updated_at"
  ).run(Number(seasonId), Number(teamId), displayNameOverride, Number(displayOrder) || 0, String(orderBasis || "manual"), now, now);
}

function assertAssignmentDoesNotOverlap(db, { seasonId, driverId, teamId, seatNumber = 1, fromRound, toRound = null, excludeId = null }) {
  const nextFrom = Number(fromRound);
  const nextTo = toRound == null ? 9999 : Number(toRound);
  const nextSeat = Number(seatNumber);
  if (![1, 2].includes(nextSeat)) throw new Error("Seat number must be 1 or 2.");
  if (toRound != null && Number(toRound) < nextFrom) throw new Error("Assignment end round must be on or after its start round.");
  const rows = excludeId == null
    ? db.prepare(
      "SELECT id, from_round, to_round FROM driver_team_assignments WHERE season_id = ? AND driver_id = ?"
    ).all(Number(seasonId), Number(driverId))
    : db.prepare(
      "SELECT id, from_round, to_round FROM driver_team_assignments WHERE season_id = ? AND driver_id = ? AND id <> ?"
    ).all(Number(seasonId), Number(driverId), Number(excludeId));
  const overlap = rows.find((row) => {
    const currentFrom = Number(row.from_round);
    const currentTo = row.to_round == null ? 9999 : Number(row.to_round);
    return currentFrom <= nextTo && currentTo >= nextFrom;
  });
  if (overlap) throw new Error(`Driver assignment overlaps assignment ${overlap.id}.`);
  const seatRows = excludeId == null
    ? db.prepare(
      "SELECT id, from_round, to_round FROM driver_team_assignments WHERE season_id = ? AND team_id = ? AND seat_number = ?"
    ).all(Number(seasonId), Number(teamId), nextSeat)
    : db.prepare(
      "SELECT id, from_round, to_round FROM driver_team_assignments WHERE season_id = ? AND team_id = ? AND seat_number = ? AND id <> ?"
    ).all(Number(seasonId), Number(teamId), nextSeat, Number(excludeId));
  const seatOverlap = seatRows.find((row) => {
    const currentFrom = Number(row.from_round);
    const currentTo = row.to_round == null ? 9999 : Number(row.to_round);
    return currentFrom <= nextTo && currentTo >= nextFrom;
  });
  if (seatOverlap) throw new Error(`Team seat overlaps assignment ${seatOverlap.id}.`);
}

function upsertDriverTeamAssignment(db, { id = null, seasonId, driverId, teamId, seatNumber = 1, fromRound, toRound = null, source = "admin", now = new Date().toISOString() }) {
  assertAssignmentDoesNotOverlap(db, { seasonId, driverId, teamId, seatNumber, fromRound, toRound, excludeId: id });
  if (id != null) {
    db.prepare("UPDATE driver_team_assignments SET team_id = ?, seat_number = ?, from_round = ?, to_round = ?, source = ?, updated_at = ? WHERE id = ?")
      .run(Number(teamId), Number(seatNumber), Number(fromRound), toRound == null ? null : Number(toRound), String(source), now, Number(id));
    return Number(id);
  }
  const result = db.prepare(
    "INSERT INTO driver_team_assignments (season_id, driver_id, team_id, seat_number, from_round, to_round, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(Number(seasonId), Number(driverId), Number(teamId), Number(seatNumber), Number(fromRound), toRound == null ? null : Number(toRound), String(source), now, now);
  return Number(result.lastInsertRowid);
}

function addEntityAlias(db, { entityType, entityId, seasonId = null, alias, source = "admin", now = new Date().toISOString() }) {
  const value = String(alias || "").trim();
  if (!value) throw new Error("Alias cannot be empty.");
  const normalized = normalizeEntityKey(value);
  const existing = seasonId == null
    ? db.prepare(
      "SELECT id, entity_id FROM entity_aliases WHERE entity_type = ? AND season_id IS NULL AND normalized_alias = ? LIMIT 1"
    ).get(String(entityType), normalized)
    : db.prepare(
      "SELECT id, entity_id FROM entity_aliases WHERE entity_type = ? AND season_id = ? AND normalized_alias = ? LIMIT 1"
    ).get(String(entityType), Number(seasonId), normalized);
  if (existing && Number(existing.entity_id) !== Number(entityId)) throw new Error("Alias already belongs to another entity.");
  if (existing) return Number(existing.id);
  const result = db.prepare(
    "INSERT INTO entity_aliases (entity_type, entity_id, season_id, alias, normalized_alias, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(String(entityType), Number(entityId), seasonId == null ? null : Number(seasonId), value, normalized, String(source), now);
  return Number(result.lastInsertRowid);
}

function addProviderReference(db, { entityType, entityId, provider, providerKey, providerLabel = null, now = new Date().toISOString() }) {
  const existing = db.prepare("SELECT id, entity_id FROM entity_provider_refs WHERE provider = ? AND provider_key = ? LIMIT 1").get(String(provider), String(providerKey));
  if (existing && Number(existing.entity_id) !== Number(entityId)) throw new Error("Provider reference already belongs to another entity.");
  if (existing) return Number(existing.id);
  const result = db.prepare(
    "INSERT INTO entity_provider_refs (entity_type, entity_id, provider, provider_key, provider_label, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(String(entityType), Number(entityId), String(provider), String(providerKey), providerLabel, now);
  return Number(result.lastInsertRowid);
}

function findEntityById(db, entityType, entityId) {
  const tables = { driver: "drivers", team: "teams", race: "races" };
  const table = tables[entityType];
  if (!table) return null;
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`).get(Number(entityId));
  return row ? { ...row, entityType, entityId: Number(row.id) } : null;
}

function resolveEntity(db, { entityType, seasonId = null, provider = null, providerKey = null, label = null }) {
  if (provider && providerKey) {
    const providerRow = db.prepare("SELECT entity_type, entity_id, provider, provider_key, provider_label FROM entity_provider_refs WHERE provider = ? AND provider_key = ? LIMIT 1").get(String(provider), String(providerKey));
    if (providerRow) return { status: providerRow.entity_type === entityType ? "resolved" : "conflict", entity: findEntityById(db, providerRow.entity_type, providerRow.entity_id), provider: providerRow };
  }
  const normalized = normalizeEntityKey(label);
  if (!normalized) return { status: "unresolved", entity: null };
  const rows = seasonId == null
    ? db.prepare(
      "SELECT entity_id, season_id, alias, source FROM entity_aliases WHERE entity_type = ? AND normalized_alias = ? AND season_id IS NULL ORDER BY season_id DESC"
    ).all(String(entityType), normalized)
    : db.prepare(
      "SELECT entity_id, season_id, alias, source FROM entity_aliases WHERE entity_type = ? AND normalized_alias = ? AND (season_id IS NULL OR season_id = ?) ORDER BY CASE WHEN season_id IS NULL THEN 1 ELSE 0 END, season_id DESC"
    ).all(String(entityType), normalized, Number(seasonId));
  const ids = Array.from(new Set(rows.map((row) => Number(row.entity_id))));
  if (ids.length === 1) return { status: "resolved", entity: findEntityById(db, entityType, ids[0]), alias: rows[0] };
  if (ids.length > 1) return { status: "ambiguous", entity: null, candidates: ids.map((id) => findEntityById(db, entityType, id)) };
  const table = { driver: "drivers", team: "teams", race: "races" }[entityType];
  if (!table) return { status: "unresolved", entity: null };
  const direct = db.prepare(`SELECT * FROM ${table} WHERE LOWER(display_name) = LOWER(?) OR slug = ? LIMIT 2`).all(String(label), slugify(label));
  if (direct.length === 1) return { status: "resolved", entity: { ...direct[0], entityType, entityId: Number(direct[0].id) } };
  if (direct.length > 1) return { status: "ambiguous", entity: null, candidates: direct.map((row) => ({ ...row, entityType, entityId: Number(row.id) })) };
  return { status: "unresolved", entity: null };
}

function listSeasonMappings(db, year) {
  const season = db.prepare("SELECT id FROM seasons WHERE year = ? LIMIT 1").get(Number(year));
  if (!season) return [];
  const mappings = [];
  const providerRows = db.prepare(
    "SELECT entity_type, entity_id, provider, provider_key, provider_label FROM entity_provider_refs ORDER BY provider, provider_key"
  ).all();
  providerRows.forEach((row) => {
    const entity = findEntityById(db, row.entity_type, row.entity_id);
    mappings.push({
      id: Number(row.id),
      mappingType: "provider",
      entityType: row.entity_type,
      provider: row.provider,
      providerKey: row.provider_key,
      entityId: Number(row.entity_id),
      seasonId: null,
      sourceLabel: row.provider_label || row.provider_key,
      sourceKey: `${row.provider}:${row.provider_key}`,
      canonicalName: entity?.display_name || null,
      status: entity ? "resolved" : "unresolved"
    });
  });
  const aliasRows = db.prepare(
    "SELECT entity_type, entity_id, alias, season_id FROM entity_aliases WHERE season_id IS NULL OR season_id = ? ORDER BY normalized_alias"
  ).all(Number(season.id));
  aliasRows.forEach((row) => {
    const entity = findEntityById(db, row.entity_type, row.entity_id);
    mappings.push({
      id: Number(row.id),
      mappingType: "alias",
      entityType: row.entity_type,
      provider: null,
      providerKey: null,
      entityId: Number(row.entity_id),
      seasonId: row.season_id == null ? null : Number(row.season_id),
      sourceLabel: row.alias,
      sourceKey: row.alias,
      canonicalName: entity?.display_name || null,
      status: entity ? "resolved" : "unresolved"
    });
  });
  return mappings;
}

function assignmentForRound(db, { seasonId, driverId, roundNumber }) {
  const row = db.prepare(
    "SELECT a.*, t.display_name AS team_name FROM driver_team_assignments a JOIN teams t ON t.id = a.team_id WHERE a.season_id = ? AND a.driver_id = ? AND a.from_round <= ? AND (a.to_round IS NULL OR a.to_round >= ?) ORDER BY a.from_round DESC LIMIT 1"
  ).get(Number(seasonId), Number(driverId), Number(roundNumber), Number(roundNumber));
  return row ? { ...row, id: Number(row.id), team_id: Number(row.team_id), seat_number: Number(row.seat_number || 1) } : null;
}

function listSeasonInputs(db, year) {
  const season = db.prepare("SELECT * FROM seasons WHERE year = ? LIMIT 1").get(Number(year));
  if (!season) return { season: null, drivers: [], teams: [], races: [], assignments: [], unresolved: [] };
  const seasonId = Number(season.id);
  const assignments = db.prepare("SELECT a.*, d.display_name AS driver_name, t.display_name AS team_name, st.display_order FROM driver_team_assignments a JOIN drivers d ON d.id = a.driver_id JOIN teams t ON t.id = a.team_id LEFT JOIN season_teams st ON st.season_id = a.season_id AND st.team_id = a.team_id WHERE a.season_id = ? ORDER BY COALESCE(st.display_order, 9999), a.seat_number, a.from_round, d.display_name").all(seasonId);
  assertAssignmentIntervals(assignments);
  const races = db.prepare("SELECT * FROM races WHERE season_id = ? ORDER BY round_number").all(seasonId)
    .map((race) => ({ ...race, derived_status: deriveRaceCalendarStatus(race) }));
  const ageReferenceDate = seasonAgeReferenceDate(season.year, races);
  const drivers = sortSeasonDrivers(db.prepare("SELECT d.*, sd.driver_number, sd.display_name_override FROM season_drivers sd JOIN drivers d ON d.id = sd.driver_id WHERE sd.season_id = ? ORDER BY d.id").all(seasonId))
    .map((driver) => ({ ...driver, age: calculateDriverAge(driver.date_of_birth, ageReferenceDate) }));
  return {
    season: { ...season, id: seasonId, year: Number(season.year) },
    drivers,
    teams: db.prepare("SELECT t.*, st.display_name_override, st.display_order, st.order_basis FROM season_teams st JOIN teams t ON t.id = st.team_id WHERE st.season_id = ? ORDER BY COALESCE(st.display_order, 9999), t.display_name").all(seasonId),
    races,
    assignments,
    unresolved: []
  };
}

function removeSeasonMembership(db, { seasonId, entityType, entityId }) {
  const membership = {
    driver: {
      table: "season_drivers",
      idColumn: "driver_id",
      label: "Driver"
    },
    team: {
      table: "season_teams",
      idColumn: "team_id",
      label: "Team"
    }
  }[String(entityType || "").trim().toLowerCase()];
  if (!membership) throw new Error("This input cannot be removed here.");
  const safeSeasonId = Number(seasonId);
  const safeEntityId = Number(entityId);
  if (!Number.isInteger(safeSeasonId) || safeSeasonId <= 0 || !Number.isInteger(safeEntityId) || safeEntityId <= 0) {
    throw new Error("A valid season input is required.");
  }
  const referenced = db.prepare(
    `SELECT 1 FROM driver_team_assignments WHERE season_id = ? AND ${membership.idColumn} = ? LIMIT 1`
  ).get(safeSeasonId, safeEntityId);
  if (referenced) {
    throw new Error(`${membership.label} has assignment history in this season and cannot be removed.`);
  }
  const result = db.prepare(
    `DELETE FROM ${membership.table} WHERE season_id = ? AND ${membership.idColumn} = ?`
  ).run(safeSeasonId, safeEntityId);
  if (Number(result.changes || 0) !== 1) {
    throw new Error(`${membership.label} is not part of this season.`);
  }
  return { entityType: String(entityType).trim().toLowerCase(), entityId: safeEntityId };
}

module.exports = {
  ENTITY_TYPES,
  addEntityAlias,
  addProviderReference,
  assignmentForRound,
  createOrGetSeason,
  ensureSeasonInputsSchema,
  findEntityById,
  listSeasonInputs,
  listSeasonMappings,
  normalizeEntityKey,
  normalizeDriverNumber,
  normalizeDriverCode,
  normalizeNationalityCode,
  normalizeDateOfBirth,
  normalizeEntityCode,
  normalizeCountryCode,
  normalizeF1EntryYear,
  calculateDriverAge,
  deriveRaceCalendarStatus,
  seasonAgeReferenceDate,
  parseReference,
  removeSeasonMembership,
  referenceFor,
  resolveEntity,
  slugify,
  splitDisplayName,
  sortSeasonDrivers,
  upsertDriver,
  upsertDriverTeamAssignment,
  upsertRace,
  upsertSeasonDriver,
  upsertSeasonTeam,
  upsertTeam
};
