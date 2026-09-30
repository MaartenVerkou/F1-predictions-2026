"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildEvidenceBundle,
  completeRaceDataImport,
  createRaceDataImport,
  ensureRaceDataSchema,
  findRaceDataSnapshot,
  listRaceDataSnapshotRevisions,
  listRaceDataSnapshots,
  saveCorrectedRaceDataSnapshot,
  saveRaceDataSnapshot,
  summarizeEvidence,
  mergeKnownGridValues
} = require("../src/race-data-evidence");

const roster = {
  drivers: ["Kimi Antonelli", "Carlos Sainz Jr."],
  teams: ["Mercedes", "Williams"]
};

test("buildEvidenceBundle normalizes race, qualifying, and standings evidence", () => {
  const evidence = buildEvidenceBundle({
    data: {
      season: 2026,
      results: [{
        round: 6,
        raceName: "Monaco Grand Prix",
        date: "2026-05-24",
        Circuit: { circuitName: "Circuit de Monaco" },
        Results: [
          {
            position: "1",
            grid: "1",
            points: "25",
            status: "Finished",
            Driver: { givenName: "Andrea Kimi", familyName: "Antonelli" },
            Constructor: { name: "Mercedes" }
          },
          {
            position: "Retired",
            grid: "4",
            points: "0",
            status: "Retired",
            Driver: { givenName: "Carlos", familyName: "Sainz" },
            Constructor: { name: "Williams" }
          }
        ]
      }],
      qualifying: [{
        round: 6,
        QualifyingResults: [
          {
            position: "1",
            Driver: { givenName: "Andrea Kimi", familyName: "Antonelli" },
            Constructor: { name: "Mercedes" }
          }
        ]
      }],
      sprints: [],
      driverStandingsByRound: new Map([[
        6,
        [
          {
            position: "1",
            points: "25",
            Driver: { givenName: "Andrea Kimi", familyName: "Antonelli" }
          }
        ]
      ]]),
      constructorStandingsByRound: new Map([[
        6,
        [
          {
            position: "1",
            points: "25",
            Constructor: { name: "Mercedes" }
          }
        ]
      ]]),
      driverOfTheDayByRound: new Map()
    },
    roster,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    fetchedAt: "2026-09-21T00:00:00.000Z",
    sourceUrls: { race: "https://example.test/race" }
  });

  assert.equal(evidence.season, 2026);
  assert.equal(evidence.roundNumber, 6);
  assert.equal(evidence.coverage.status, "complete");
  assert.equal(evidence.coverage.sources.race.count, 2);
  assert.equal(evidence.coverage.sources.qualifying.count, 1);
  assert.equal(evidence.coverage.sources.sprint.available, false);
  assert.equal(evidence.race.rows[0].driver, "Kimi Antonelli");
  assert.equal(evidence.race.rows[1].driver, "Carlos Sainz Jr.");
  assert.equal(evidence.race.rows[1].position, null);
  assert.equal(evidence.race.rows[1].status, "Retired");
  assert.equal(evidence.sourceUrls.race, "https://example.test/race");
});

test("race evidence preserves the provider gap for unclassified results", () => {
  const evidence = buildEvidenceBundle({
    data: {
      season: 2026,
      results: [{
        round: 1,
        raceName: "Australian Grand Prix",
        Results: [{
          position: null,
          status: "NC",
          laps: 43,
          sessionGap: "+15 LAPS",
          Driver: { givenName: "Lance", familyName: "Stroll" },
          Constructor: { name: "Aston Martin" }
        }]
      }],
      qualifying: [],
      sprints: [],
      driverStandingsByRound: new Map(),
      constructorStandingsByRound: new Map(),
      driverOfTheDayByRound: new Map()
    },
    roster: { drivers: ["Lance Stroll"], teams: ["Aston Martin"] },
    roundNumber: 1,
    roundName: "Australian Grand Prix"
  });

  assert.equal(evidence.race.rows[0].laps, 43);
  assert.equal(evidence.race.rows[0].sessionGap, "+15 LAPS");
});

test("evidence keeps an unclassified qualifying result unavailable", () => {
  const evidence = buildEvidenceBundle({
    data: {
      season: 2026,
      results: [],
      qualifying: [{
        round: 4,
        QualifyingResults: [{
          position: null,
          positionText: null,
          status: null,
          Driver: { givenName: "Fernando", familyName: "Alonso" },
          Constructor: { name: "Aston Martin" }
        }]
      }],
      sprints: [],
      driverStandingsByRound: new Map(),
      constructorStandingsByRound: new Map(),
      driverOfTheDayByRound: new Map()
    },
    roster: { drivers: ["Fernando Alonso"], teams: ["Aston Martin"] },
    roundNumber: 4,
    roundName: "Miami Grand Prix"
  });

  assert.equal(evidence.qualifying.rows[0].position, null);
  assert.equal(evidence.qualifying.rows[0].positionText, null);
  assert.equal(evidence.qualifying.rows[0].status, null);
});

test("missing or zero starting-grid positions stay unavailable", () => {
  const evidence = buildEvidenceBundle({
    data: {
      season: 2026,
      results: [{
        round: 4,
        raceName: "Miami Grand Prix",
        Results: [{
          position: "1",
          grid: null,
          Driver: { givenName: "Kimi", familyName: "Antonelli" },
          Constructor: { name: "Mercedes" }
        }]
      }],
      qualifying: [],
      sprints: [],
      driverStandingsByRound: new Map(),
      constructorStandingsByRound: new Map(),
      driverOfTheDayByRound: new Map()
    },
    roster: { drivers: ["Kimi Antonelli"], teams: ["Mercedes"] },
    roundNumber: 4,
    roundName: "Miami Grand Prix"
  });

  assert.equal(evidence.race.rows[0].grid, null);
  evidence.race.rows[0].grid = 0;
  assert.equal(mergeKnownGridValues(evidence, []), 0);
  assert.equal(evidence.race.rows[0].grid, null);
});

test("provider refresh preserves a previously validated grid when the source omits it", () => {
  const evidence = {
    race: { rows: [{ driver_id: 11, driver: "Kimi Antonelli", grid: null }] },
    sessions: {
      race: { rows: [{ driver_id: 11, driver: "Kimi Antonelli", grid: null }] },
      startingGrid: { available: false, status: "unavailable", rows: [] }
    },
    coverage: { sources: { startingGrid: { available: false, count: 0 } } }
  };
  const restored = mergeKnownGridValues(evidence, [{
    race: { rows: [{ driver_id: 11, driver: "Kimi Antonelli", grid: 1 }] },
    sessions: { race: { rows: [{ driver_id: 11, driver: "Kimi Antonelli", grid: 1 }] } }
  }]);

  assert.equal(restored, 2);
  assert.equal(evidence.race.rows[0].grid, 1);
  assert.equal(evidence.sessions.race.rows[0].grid, 1);
  assert.equal(evidence.sessions.startingGrid.available, true);
  assert.equal(evidence.sessions.startingGrid.rows[0].position, 1);
  assert.equal(evidence.coverage.sources.startingGrid.count, 1);
});

test("evidence keeps provider identity and raw session details for future derivations", () => {
  const evidence = buildEvidenceBundle({
    data: {
      season: 2026,
      results: [{
        round: 1,
        raceName: "Australian Grand Prix",
        Results: [{
          number: "63",
          position: "1",
          points: "25",
          Time: { time: "1:30:00.000" },
          FastestLap: { rank: "1", Time: { time: "1:20.000" }, AverageSpeed: { speed: "190.5" } },
          Driver: { driverId: "russell", givenName: "George", familyName: "Russell" },
          Constructor: { constructorId: "mercedes", name: "Mercedes" }
        }]
      }],
      qualifying: [{
        round: 1,
        QualifyingResults: [{
          position: "1", Q1: "1:20.000", Q2: "1:19.000", Q3: "1:18.000",
          Driver: { driverId: "russell", givenName: "George", familyName: "Russell" },
          Constructor: { constructorId: "mercedes", name: "Mercedes" }
        }]
      }],
      sprints: [],
      driverStandingsByRound: new Map(),
      constructorStandingsByRound: new Map(),
      driverOfTheDayByRound: new Map()
    },
    roster: { drivers: ["George Russell"], teams: ["Mercedes"] },
    roundNumber: 1,
    roundName: "Australian Grand Prix"
  });

  assert.equal(evidence.race.rows[0].provider_driver_id, "russell");
  assert.equal(evidence.race.rows[0].fastestLapTime, "1:20.000");
  assert.equal(evidence.race.rows[0].fastestLapAverageSpeed, 190.5);
  assert.deepEqual(evidence.qualifying.rows[0].qualifyingTimes, {
    q1: "1:20.000", q2: "1:19.000", q3: "1:18.000"
  });
  assert.equal(evidence.raw.provider, "openf1");
  assert.equal(evidence.raw.race.Results[0].Driver.driverId, "russell");
});

test("evidence records the input revision and unresolved canonical rows", () => {
  const evidence = buildEvidenceBundle({
    data: {
      season: 2026,
      results: [{
        round: 6,
        raceName: "Monaco Grand Prix",
        Results: [{
          position: "1",
          Driver: { givenName: "Known", familyName: "Driver" },
          Constructor: { name: "Unknown Team" }
        }]
      }],
      qualifying: [],
      sprints: [],
      driverStandingsByRound: new Map(),
      constructorStandingsByRound: new Map(),
      driverOfTheDayByRound: new Map()
    },
    roster: { drivers: ["Known Driver"], teams: ["Unknown Team"] },
    canonicalCatalog: {
      driver: [{ id: 1, value: "driver:1", label: "Known Driver" }],
      team: [{ id: 10, value: "team:10", label: "Canonical Team" }]
    },
    catalogRevision: "catalog-123",
    cutoffRound: 6,
    sourceIdentity: "jolpica:2026:r6",
    payloadRevision: "payload-456",
    roundNumber: 6,
    roundName: "Monaco Grand Prix"
  });

  assert.equal(evidence.catalogRevision, "catalog-123");
  assert.equal(evidence.cutoffRound, 6);
  assert.equal(evidence.sourceIdentity, "jolpica:2026:r6");
  assert.equal(evidence.payloadRevision, "payload-456");
  assert.equal(evidence.race.rows[0].driver_id, 1);
  assert.equal(evidence.race.rows[0].team_id, null);
  assert.equal(evidence.unresolved.raceTeams, 1);
  assert.equal(evidence.coverage.status, "incomplete");
});

test("summarizeEvidence reports source row counts", () => {
  const summary = summarizeEvidence({
    coverage: {
      status: "incomplete",
      sources: {
        race: { count: 20 },
        qualifying: { count: 20 },
        sprint: { count: 0 },
        driverStandings: { count: 20 },
        constructorStandings: { count: 10 }
      }
    }
  });
  assert.deepEqual(summary, {
    status: "incomplete",
    raceCount: 20,
    qualifyingCount: 20,
    sprintCount: 0,
    damageCount: 0,
    driverStandingsCount: 20,
    constructorStandingsCount: 10
  });
});

test("persisted evidence is reusable by round and idempotent for the same sync", (t) => {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.dialect = "sqlite";
  db.exec(`
    CREATE TABLE actual_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_data_import_id INTEGER,
      source_data_snapshot_id INTEGER
    );
  `);
  ensureRaceDataSchema(db);
  t.after(() => db.close());

  const importId = createRaceDataImport(db, {
    season: 2026,
    syncId: "sync-r6",
    requestedRounds: 1,
    sourceNote: "test import"
  });
  const evidence = {
    roundName: "Monaco Grand Prix",
    catalogRevision: "catalog-123",
    payloadRevision: "payload-456",
    sourceIdentity: "jolpica:2026:r6",
    cutoffRound: 6,
    coverage: { status: "complete", sources: { race: { count: 1 } } },
    race: { rows: [{ driver: "driver:1", constructor: "team:10", position: 1 }] }
  };
  const firstId = saveRaceDataSnapshot(db, {
    season: 2026,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    syncId: "sync-r6",
    importId,
    fetchedAt: "2026-09-21T00:00:00.000Z",
    evidence
  });
  const secondId = saveRaceDataSnapshot(db, {
    season: 2026,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    syncId: "sync-r6",
    importId,
    fetchedAt: "2026-09-21T00:00:00.000Z",
    evidence
  });

  assert.equal(secondId, firstId);
  assert.equal(listRaceDataSnapshots(db, 2026).length, 1);
  const persisted = findRaceDataSnapshot(db, 2026, 6);
  assert.deepEqual(persisted.payload.race.rows[0], evidence.race.rows[0]);
  assert.equal(persisted.catalog_revision, "catalog-123");
  assert.equal(persisted.payload_revision, "payload-456");
  assert.equal(persisted.source_identity, "jolpica:2026:r6");
  assert.equal(persisted.cutoff_round, 6);
  assert.equal(completeRaceDataImport(db, importId, { completedRounds: 1 }), 1);
  assert.equal(db.prepare("SELECT status, completed_rounds FROM race_data_imports WHERE id = ?").get(importId).status, "completed");
});

test("admin evidence corrections create an auditable revision without mutating the base", (t) => {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.dialect = "sqlite";
  db.exec(`
    CREATE TABLE actual_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_data_import_id INTEGER,
      source_data_snapshot_id INTEGER
    );
    CREATE TABLE responses (id INTEGER PRIMARY KEY, question_id TEXT, answer TEXT);
    INSERT INTO responses (id, question_id, answer) VALUES (1, 'q1', 'driver:1');
  `);
  ensureRaceDataSchema(db);
  t.after(() => db.close());

  const baseEvidence = {
    roundName: "Monaco Grand Prix",
    cutoffRound: 6,
    coverage: { status: "complete", sources: { race: { count: 1 } } },
    race: { rows: [{ driver_id: 1, driver: "George Russell", position: 2, status: "Finished", points: 18 }] }
  };
  const baseId = saveRaceDataSnapshot(db, {
    season: 2026,
    roundNumber: 6,
    roundName: "Monaco Grand Prix",
    syncId: "sync-r6-base",
    fetchedAt: "2026-09-21T00:00:00.000Z",
    evidence: baseEvidence
  });
  const unrelatedId = saveRaceDataSnapshot(db, {
    season: 2026,
    roundNumber: 7,
    roundName: "Barcelona-Catalunya Grand Prix",
    syncId: "sync-r7-base",
    fetchedAt: "2026-09-21T00:00:00.000Z",
    evidence: { ...baseEvidence, roundName: "Barcelona-Catalunya Grand Prix", roundNumber: 7 }
  });
  db.prepare("INSERT INTO actual_snapshots (source_data_snapshot_id) VALUES (?)").run(baseId);
  const correctedId = saveCorrectedRaceDataSnapshot(db, {
    baseSnapshot: findRaceDataSnapshot(db, 2026, 6),
    correctedByUserId: 42,
    correctionReason: "Official classification corrected after steward decision.",
    evidence: {
      ...baseEvidence,
      race: { rows: [{ ...baseEvidence.race.rows[0], position: 1, points: 25 }] }
    }
  });

  assert.notEqual(correctedId, baseId);
  const revisions = listRaceDataSnapshotRevisions(db, 2026, 6);
  assert.equal(revisions.length, 2);
  assert.equal(revisions[0].id, baseId);
  assert.equal(revisions[1].id, correctedId);
  assert.equal(revisions[1].revision_kind, "admin_correction");
  assert.equal(revisions[1].supersedes_snapshot_id, baseId);
  assert.equal(revisions[1].corrected_by_user_id, 42);
  assert.equal(revisions[1].correction_reason, "Official classification corrected after steward decision.");
  assert.equal(revisions[0].payload.race.rows[0].position, 2);
  assert.equal(revisions[1].payload.race.rows[0].position, 1);
  assert.equal(findRaceDataSnapshot(db, 2026, 7).id, unrelatedId);
  assert.equal(db.prepare("SELECT source_data_snapshot_id FROM actual_snapshots LIMIT 1").get().source_data_snapshot_id, baseId);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM responses").get().count, 1);
});
